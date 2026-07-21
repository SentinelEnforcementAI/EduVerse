import { NextResponse, type NextRequest } from "next/server";

import { db } from "@sentinel/db";

import { env } from "@/env";
import { consumeMagicLink } from "@/server/auth/magic-link";
import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/server/auth/session";

// Lands here from the emailed magic link. Consumes the token, opens a
// session, and sends the user to the dashboard.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(
      new URL("/sign-in?error=invalid_link", env.APP_URL),
    );
  }

  const result = await consumeMagicLink(db, token);
  if (!result.ok) {
    return NextResponse.redirect(
      new URL("/sign-in?error=invalid_link", env.APP_URL),
    );
  }

  const session = await createSession({
    id: result.userId,
    tenantId: result.tenantId,
  });

  const response = NextResponse.redirect(new URL("/dashboard", env.APP_URL));
  response.cookies.set(
    SESSION_COOKIE,
    session.token,
    sessionCookieOptions(session.expiresAt),
  );
  return response;
}
