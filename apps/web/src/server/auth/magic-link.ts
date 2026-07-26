import type { SystemDb } from "@sentinel/db";

import { env } from "@/env";
import { sendMagicLinkEmail } from "@/server/auth/email";
import {
  generateToken,
  hashToken,
  isMagicLinkUsable,
  magicLinkExpiry,
} from "@/server/auth/tokens";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// A public, unauthenticated endpoint: cap how many links one account can be
// sent in a window so it can't be used to email-bomb a DSL or run up SES spend.
// The cap is generous enough for genuine "resend" retries.
export const MAGIC_LINK_WINDOW_MINUTES = 15;
export const MAGIC_LINK_MAX_PER_WINDOW = 5;

// Starts the magic link flow for an email address.
//
// Sign-in is invite-only: DSL accounts are provisioned (seed or the
// user:add script in @sentinel/db), never self-served. Unknown addresses
// are silently ignored — the caller's response is identical either way, so
// the endpoint cannot be used to discover which addresses hold accounts.
export async function requestMagicLink(
  db: SystemDb,
  rawEmail: string,
): Promise<void> {
  const email = normaliseEmail(rawEmail);

  const user = await db.user.findUnique({ where: { email } });
  // Unknown or deactivated accounts are treated identically to a valid one
  // from the caller's side (no link is sent, same response), so the endpoint
  // leaks nothing and a deactivated account can never sign back in.
  if (!user || user.status === "DEACTIVATED") return;

  // Throttle per account: if this address has already been sent the cap within
  // the window, silently stop (same response as always), so the endpoint can't
  // be used to flood an inbox or drive SES cost.
  const windowStart = new Date(
    Date.now() - MAGIC_LINK_WINDOW_MINUTES * 60 * 1000,
  );
  const recent = await db.magicLinkToken.count({
    where: { userId: user.id, createdAt: { gte: windowStart } },
  });
  if (recent >= MAGIC_LINK_MAX_PER_WINDOW) return;

  const token = generateToken();
  await db.magicLinkToken.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt: magicLinkExpiry(),
    },
  });

  const url = new URL("/api/auth/verify", env.APP_URL);
  url.searchParams.set("token", token);

  await sendMagicLinkEmail({ to: email, url: url.toString() });
}

export type ConsumeResult =
  | { ok: true; userId: string; tenantId: string | null }
  | { ok: false; reason: "invalid" | "expired_or_used" };

// Verifies a magic link token and consumes it (single use).
export async function consumeMagicLink(
  db: SystemDb,
  rawToken: string,
): Promise<ConsumeResult> {
  const record = await db.magicLinkToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!record) return { ok: false, reason: "invalid" };
  if (!isMagicLinkUsable(record)) {
    return { ok: false, reason: "expired_or_used" };
  }

  // A link issued before the account was deactivated must not grant a session.
  const user = await db.user.findUnique({
    where: { id: record.userId },
    select: { status: true },
  });
  if (!user || user.status === "DEACTIVATED") {
    return { ok: false, reason: "invalid" };
  }

  // Single-use, race-safe: the update is itself the guard. Two requests
  // presenting the same token concurrently both pass the check above, but only
  // the one that flips consumedAt from null wins; the loser sees count 0 and is
  // rejected. (The read-then-write above is not atomic on its own.)
  const consumed = await db.magicLinkToken.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return { ok: false, reason: "expired_or_used" };
  }

  return { ok: true, userId: record.userId, tenantId: record.tenantId };
}
