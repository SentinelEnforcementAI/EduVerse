import { NextResponse } from "next/server";

import { env } from "@/env";
import { revokeCurrentSession, SESSION_COOKIE } from "@/server/auth/session";

// Sign out: soft-revokes the DB session and clears the cookie.
export async function POST() {
  await revokeCurrentSession();

  const response = NextResponse.redirect(new URL("/", env.APP_URL), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
