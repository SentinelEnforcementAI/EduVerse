# Production hardening

The final commercialisation slice (8). "Production hardening" spans code, infra
and operations; this document is the honest ledger of each — **done in code**,
**wired in Terraform**, or **operational / CTO sign-off**. When the operational
column is signed off, the roadmap's closing statement holds: *ready to sell,
pending CTO sign-off, legal and the Fieldfisher DPA framework.*

Everything below preserves the CLAUDE.md non-negotiables: sealed identity,
human-in-the-loop, append-only audit, explainability, and UK data residency
(eu-west-2 only).

## Done in code (this slice, tested)

- **Security response headers on every route** (`apps/web/next.config.ts` +
  `src/lib/security-headers.ts`): a self-only Content-Security-Policy with
  `frame-ancestors 'none'` and `object-src 'none'`, HSTS (2 years, preload),
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, a strict
  Referrer-Policy, and a Permissions-Policy that disables camera, microphone
  and geolocation (a safeguarding tool needs none).
- **Liveness endpoint** (`/api/health`): a dependency-free 200 for the load
  balancer and uptime monitors — a DB blip must not cycle healthy tasks.
- **Structured error-reporting seam** (`src/server/observability/report-error.ts`,
  wired into the tRPC error handler): every server error becomes one JSON line
  (`"level":"error"`), alertable via a log metric filter, and the single place
  a hosted error tracker drops in.

## Wired in Terraform (this slice; applies on the next `terraform apply`)

- **CloudWatch alarms → SNS** (`infra/terraform/monitoring.tf`): ALB 5xx and
  unhealthy hosts; RDS free-storage-low and CPU-high; web and worker
  "no running tasks"; and an application-error spike from the log metric
  filter. Set `alerts_email` to subscribe. Closes the "hooks exist, nothing is
  wired" gap in `infra/README.md`.
- **Multi-AZ RDS is now a switch** (`rds_multi_az`, default `false`). Flip to
  `true` before real pupil data (see below).

## Operational / CTO sign-off (not code — the remaining checklist)

Each of these is a deliberate CTO-DECISION with an owner outside the codebase.
None is blocked by the product; all should be closed before onboarding a
customer with real pupil data.

1. **Multi-AZ Postgres.** Set `rds_multi_az = true` and re-apply. (~2× the DB
   instance cost; the switch is built.)
2. **Second NAT gateway.** Today one NAT is shared across AZs — a single point
   of egress failure. Add a per-AZ NAT before production. (Terraform change to
   `network.tf`; a cost/resilience trade-off left to the CTO.)
3. **WAF on the ALB.** AWS WAF with the managed rule sets (common, SQLi,
   bad-inputs) in front of the load balancer. Not wired — a scoped Terraform
   addition plus rule tuning.
4. **Tested backups + DR drill.** RDS keeps 14-day automated backups and
   deletion protection today. What remains is a **rehearsed restore**: restore
   to a scratch stack, verify integrity, and record the RTO/RPO. Backups are
   only real once a restore has been proven.
5. **Staging environment.** A non-production stack (its own `project` prefix
   and state key — the provisioning factory already supports this) for
   pre-release verification and DR rehearsals.
6. **Error tracking (hosted).** Wire Sentry (or equivalent) into the
   `report-error` seam behind a `SENTRY_DSN`. The seam and structured logs
   exist; the hosted service is the decision.
7. **Secrets rotation.** RDS master password is managed by AWS; the app role
   password and the Wonde key are static. Put them on a rotation schedule
   (Secrets Manager rotation + a redeploy hook).
8. **Independent penetration test + remediation.** A third-party test against a
   staging stack, with findings triaged and fixed before sign-off. The RLS
   isolation, sealed identity and append-only audit are built and tested, but an
   external test is a sign-off gate, not something to self-assert.
9. **Accessibility audit (WCAG 2.1 AA).** `DESIGN.md` targets AA; verify it with
   an audit (axe/Lighthouse pass plus manual keyboard and screen-reader checks)
   and fix findings. A follow-on is nonce-based CSP (removing `'unsafe-inline'`
   from `script-src`), which pairs with the accessibility/security pass.

## Assurance review

A whole-codebase assurance pass ran three independent audits — a sealed-identity
leak sweep, a RLS / tenant-isolation audit, and a security review (auth,
secrets, injection, audit integrity, human-in-the-loop). Verdict: tenant
isolation is airtight at the database (every table `FORCE` RLS + policy, no
`USING(true)`, no unfiltered cross-tenant query), no critical/high security
vulnerabilities, audit is genuinely append-only, and nothing auto-actions a
child. Sealed identity holds on every UI surface and the LLM path.

**Fixed in the assurance-hardening slice (all tested):**

- **Sealed the superseded `signals.list` / `signals.byId`** — the legacy router
  (unused by the UI, still mounted) returned raw pupil names/UPN; it now returns
  a sealed reference only, with a regression test that fails if a name or UPN
  ever reaches those payloads again.
- **Rate-limited the public magic-link request** (per-account window) so it
  can't be used to flood a DSL's inbox or drive SES cost.
- **Made magic-link consumption race-safe** (guarded single-use write).
- **Aligned the worker's sealed-reference helper** with the canonical one.
- **Added DB-level RLS isolation tests** for the newer tables (`intake_items`,
  `notifications`) so a weakened policy fails CI.

**Deferred to CTO / DPA gate (judgement calls, not defects):**

1. **Repository search vs a once-revealed name.** Cross-repository document
   search can surface a name that already entered the record via an audited
   reveal, to a colleague who has not revealed that case. Decide the policy
   (strict per-case sealing vs "revealed to the school") and implement to match.
2. **`trust_id` predicate on trust-level tables' RLS.** `billing_accounts`,
   `billing_snapshots` and `rule_configs` enforce only `app.is_system()`;
   cross-trust isolation currently rests on the application filter (correct
   everywhere today). Add an `app.trust_id()` context + predicate for
   defence-in-depth (the deferred `CTO-DECISION`).
3. **Session policy for shared school devices.** 7-day TTL, no idle timeout;
   force the cookie `Secure` flag in production independent of `APP_URL`.
4. **Rate-limit residuals.** Add per-IP limiting (Redis is in the stack) and
   equalise request latency across known/unknown accounts to fully close the
   timing side-channel.
5. **Coverage tooling.** Rules 90% / sync 74% / db 65% / web 39% (web is low
   only because it counts UI components; the server logic is the tested part).
   Wire a coverage reporter + threshold if a hard gate is wanted.

## Definition of done

Slices 1–8 are complete in code and Terraform. The nine items above are the
operational and sign-off gates. When they are closed — with legal and the
Fieldfisher DPA framework — the product is ready to sell.
