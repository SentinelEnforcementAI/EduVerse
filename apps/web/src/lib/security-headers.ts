// Security response headers for every route (commercialisation slice 8:
// production hardening). Applied in next.config's headers(). Kept here as a
// pure function so it is unit-testable and the same policy is easy to reason
// about in one place.
//
// The Content-Security-Policy is a pragmatic baseline for a Next.js + tRPC app:
// everything loads from self; inline scripts/styles are allowed because Next's
// hydration and Tailwind inject them. Tightening to a nonce-based script policy
// (removing 'unsafe-inline' for scripts) is the follow-on hardening noted in
// docs/HARDENING.md.

const CSP_DIRECTIVES: Record<string, string[]> = {
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  // The app only talks to its own origin (tRPC). No third-party endpoints.
  "connect-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  // Clickjacking defence, alongside X-Frame-Options for older agents.
  "frame-ancestors": ["'none'"],
  "object-src": ["'none'"],
};

export function contentSecurityPolicy(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");
}

export type SecurityHeader = { key: string; value: string };

export function securityHeaders(): SecurityHeader[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy() },
    // Only meaningful over HTTPS; harmless over HTTP and correct once the ALB
    // serves TLS (per-customer subdomain + ACM). Two years, subdomains, preload.
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    // A safeguarding tool needs no camera, microphone or geolocation.
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    },
  ];
}
