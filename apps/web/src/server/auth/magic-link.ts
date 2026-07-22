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
  if (!user) return;

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

  await db.magicLinkToken.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, userId: record.userId, tenantId: record.tenantId };
}
