import { cookies } from "next/headers";

import { db, type User } from "@sentinel/db";

import { env } from "@/env";
import {
  generateToken,
  hashToken,
  isSessionActive,
  sessionExpiry,
} from "@/server/auth/tokens";

export const SESSION_COOKIE = "sw_session";

export type AuthSession = {
  sessionId: string;
  user: User;
};

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

// Creates a DB-backed session and returns the raw cookie token.
export async function createSession(user: {
  id: string;
  tenantId: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = sessionExpiry();
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

// Resolves the current request's session from the cookie, or null.
export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || !isSessionActive(session)) return null;

  return { sessionId: session.id, user: session.user };
}

// Sign-out is a soft revocation (revoked_at), never a hard delete, so the
// session trail stays intact for the audit log (build step 8).
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;

  await db.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
