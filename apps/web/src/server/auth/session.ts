import { cookies } from "next/headers";

import { systemDb, type User } from "@sentinel/db";

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

// The session cookie is `secure` only when the app is actually served over
// HTTPS — derived from APP_URL's scheme, not NODE_ENV. A `secure` cookie set
// on a plain-HTTP page is silently dropped by the browser, which would break
// sign-in. Put a TLS certificate / HTTPS APP_URL in front and this flips to
// secure automatically (see infra/README.md, DNS + TLS).
//
// Evaluated per call, and optional-chained: during `next build` env
// validation is skipped and APP_URL is absent, so this must not throw at
// module load.
export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.APP_URL?.startsWith("https://") ?? false,
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
  await systemDb.session.create({
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

  const session = await systemDb.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || !isSessionActive(session)) return null;
  // A deactivated account holds no live session, even if the cookie is valid.
  if (session.user.status === "DEACTIVATED") return null;

  return { sessionId: session.id, user: session.user };
}

// Sign-out is a soft revocation (revoked_at), never a hard delete, so the
// session trail stays intact for the audit log (build step 8).
export async function revokeCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return;

  await systemDb.session.updateMany({
    where: { tokenHash: hashToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
