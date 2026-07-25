import { NextResponse } from "next/server";

// Liveness endpoint (commercialisation slice 8: production hardening). The load
// balancer and uptime monitors hit this to know the web process is serving. It
// deliberately does NOT touch the database — liveness is "is this process up",
// not "is every dependency healthy"; a DB blip must not make the ALB cycle
// otherwise-healthy tasks. Readiness (dependency checks) is a separate concern.
export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}
