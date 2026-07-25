import { describe, expect, it, vi } from "vitest";

import { GET as healthGet } from "@/app/api/health/route";
import {
  reportError,
  setErrorSinkForTesting,
} from "@/server/observability/report-error";

import { contentSecurityPolicy, securityHeaders } from "./security-headers";

// Production hardening (commercialisation slice 8): the security headers, the
// liveness endpoint, and the error-reporting seam.

describe("security headers", () => {
  it("sets the core security headers", () => {
    const keys = securityHeaders().map((h) => h.key);
    expect(keys).toContain("Content-Security-Policy");
    expect(keys).toContain("Strict-Transport-Security");
    expect(keys).toContain("X-Frame-Options");
    expect(keys).toContain("X-Content-Type-Options");
    expect(keys).toContain("Referrer-Policy");
    expect(keys).toContain("Permissions-Policy");
  });

  it("frames a clickjacking-proof, self-only CSP", () => {
    const csp = contentSecurityPolicy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // No third-party connect target — the app only talks to its own origin.
    expect(csp).toContain("connect-src 'self'");
  });
});

describe("health endpoint", () => {
  it("returns 200 ok for liveness", async () => {
    const res = healthGet();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});

describe("error reporting seam", () => {
  it("routes an error (with context) through the sink and never throws", () => {
    const sink = vi.fn();
    setErrorSinkForTesting(sink);
    try {
      reportError(new Error("boom"), { path: "signals.list", code: "X" });
      expect(sink).toHaveBeenCalledOnce();
      const [err, ctx] = sink.mock.calls[0]!;
      expect((err as Error).message).toBe("boom");
      expect(ctx).toMatchObject({ path: "signals.list" });

      // A throwing sink must not propagate into the request path.
      setErrorSinkForTesting(() => {
        throw new Error("sink failed");
      });
      expect(() => reportError(new Error("again"))).not.toThrow();
    } finally {
      setErrorSinkForTesting(null);
    }
  });
});
