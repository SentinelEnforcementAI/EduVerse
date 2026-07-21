import { createHash, randomBytes } from "node:crypto";

// Magic links are single-use and short-lived.
export const MAGIC_LINK_TTL_MINUTES = 15;

// CTO-DECISION: session lifetime policy for shared school devices. Seven days
// is the simplest working version; a school-safe policy (shorter TTL, idle
// timeout) should be set before real pupil data arrives.
export const SESSION_TTL_DAYS = 7;

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only hashes are persisted; the raw token exists solely in the emailed link
// or the session cookie.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function magicLinkExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isMagicLinkUsable(
  token: { expiresAt: Date; consumedAt: Date | null },
  now: Date = new Date(),
): boolean {
  return token.consumedAt === null && token.expiresAt.getTime() > now.getTime();
}

export function isSessionActive(
  session: { expiresAt: Date; revokedAt: Date | null },
  now: Date = new Date(),
): boolean {
  return (
    session.revokedAt === null && session.expiresAt.getTime() > now.getTime()
  );
}
