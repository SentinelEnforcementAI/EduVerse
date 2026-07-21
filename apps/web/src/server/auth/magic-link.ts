import type { PrismaClient } from "@sentinel/db";

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
// CTO-DECISION: sign-in eligibility. The simplest working version creates a
// user on first sign-in so the auth shell is usable before any admin tooling
// exists. Before real school users arrive this must become invite-only
// (DSLs are provisioned, never self-served) — swap the upsert for a lookup
// that declines unknown addresses.
export async function requestMagicLink(
  db: PrismaClient,
  rawEmail: string,
): Promise<void> {
  const email = normaliseEmail(rawEmail);

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

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
  db: PrismaClient,
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
