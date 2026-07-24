# Commercialisation roadmap

The path from the current design-partner MVP to "ready to sell, pending CTO
sign-off, legal and the Fieldfisher DPA framework." This is the engineering
definition of done. It is the reference the incoming CTO signs off against.

Everything here preserves the non-negotiables in CLAUDE.md: sealed identity,
human-in-the-loop enforced in schema, full append-only audit, explainability,
and UK data residency (eu-west-2 only).

## Commercial context (fixed inputs)

- **Pricing:** cost-per-pupil, plus a flat £50,000 per MAT.
- **Legal / DPA / DPIA:** handled by Fieldfisher, pre-signing. Not an
  engineering deliverable, but the mailbox integration (below) materially
  expands the DPIA surface and must be scoped into that work explicitly.
- **Support and go-to-market collateral:** follow once we are ready to
  promote and sign. Not blocking the engineering definition of done.

So "ready to sell" here means: **the product and platform are complete and
hardened; only CTO sign-off, legal and the DPA framework remain.**

---

## 1. How we deploy customer environments

### Recommendation: silo per MAT

Two models are possible, and the row-level-security tenant model works inside
either:

- **Pool (shared):** one environment, every MAT is a set of tenants in a shared
  database isolated by RLS. Cheapest, instant onboarding, one thing to operate.
  Weakness: "your children's data shares a database with other trusts" is a
  procurement objection, and a single RLS defect is a cross-customer blast
  radius.
- **Silo (per MAT):** each MAT gets its own isolated AWS stack (own database,
  encryption, backups, subdomain). Hard isolation, contained blast radius,
  per-customer residency and backup control.

**For safeguarding data at £50k per MAT, lead with silo.** The economics are
trivial (a ~£100/month stack against a £50k contract), and "one MAT's data can
never physically touch another's" is a far stronger DPO story than "we have
good RLS." Keep pool available for a future self-serve / SMB tier.

The existing **Bootstrap AWS** workflow already provisions a complete isolated
stack; it is roughly 80% of a per-customer environment factory. **Slice 2 built
the remaining 20%** — see `docs/PROVISIONING.md`: a **Provision customer**
workflow that parameterises the stack per MAT (`project = sentinel-<slug>`, a
separate remote-state key per customer) and finishes by seeding the customer's
trust, schools and first administrator, followed by a guided in-product
onboarding flow. The data-layer factory is idempotent and unit-tested.

### What silo needs to be a flick of a switch

1. **Provisioning control plane.** One action stands up a named customer's
   stack: VPC, RDS, Redis, ECS services, DNS/subdomain, ACM certificate,
   secrets, then seeds their trust and schools and creates their first admin.
   This is the Bootstrap workflow, parameterised per customer and productionised
   (remote Terraform state per customer, a workspace or state key per MAT).
2. **Fleet management.** Roll a migration or a release safely across *every*
   customer environment, and aggregate health, logs and alerts into one place.
   Today deploy is a manual single-environment dispatch; that does not scale
   past a handful of customers.
3. **Customer registry.** A small record of customer to environment mapping
   (subdomain, region, RDS, version, pupil count) that provisioning writes and
   billing reads.

### Deferred infra decisions to close before real data

From `infra/README.md` (currently marked CTO-DECISION):

- Remote Terraform state (S3 + DynamoDB), per customer.
- Multi-AZ RDS and a second NAT gateway.
- Web autoscaling / desired_count > 1, WAF on the ALB, CloudFront.
- CloudWatch alarms (log-group hooks exist, nothing is wired).
- DNS + TLS per customer subdomain (the app already flips the session cookie to
  `secure` automatically once `APP_URL` is https).

---

## 2. Email as mission control (the flagship)

The feature that turns Watch from a dashboard the DSL checks into the place the
DSL works, and the one that makes "nothing slips through the gaps" literally
true: the communications themselves live in the system, threaded to the child.

### What already exists (the skeleton)

- Drafting of MASH referrals, parent/carer letters, SENCO consultations and the
  rest (`server/comms/templates.ts`).
- The referral lifecycle: submit, chase, decide, re-refer (`casework` router).
- Pastoral review scheduling with invitees (`casework.scheduleReview`).
- The governance stance today: "Watch never sends anything itself" — it drafts
  and files, the human downloads and sends elsewhere.

Email is the layer that makes all of this live.

### Phase 1 — Outbound send (lower risk)

A human reviews a drafted referral or letter and sends it from the platform,
threaded to the case; the sent message is written to a case communications
timeline and the audit log. This preserves human-in-the-loop exactly: the
machine drafts, the person sends. It replaces "download and paste into Outlook"
with one audited click.

- Send via the connected mailbox (Graph / Workspace) so mail comes from the
  school's own domain with correct SPF/DKIM/DMARC, or via a verified subdomain
  as a fallback.
- New `CaseMessage` append-only model (direction, from, to, subject, body,
  sentBy, threadId), tied to a signal/case, sealed on list views.

### Phase 2 — Inbound capture (higher value, higher risk)

Connect the school's **dedicated safeguarding mailbox** (for example
`safeguarding@school.org.uk`) via Microsoft 365 Graph or Google Workspace OAuth.
Inbound mail is matched to a case (pupil reference, sender, thread) and surfaced
as case communications, so a teacher's emailed concern is captured against the
child instead of sitting unread. Unmatched mail lands in an intake queue for a
DSL to assign. This is where the mission statement bites hardest.

### Constraints (non-negotiable)

- **Biggest data-protection surface in the product.** Email bodies about
  children are special-category data. Fieldfisher's DPIA/DPA must explicitly
  cover the mailbox integration; loop them in at design time, not after.
- Connect a **dedicated safeguarding mailbox**, never a DSL's whole personal
  inbox. Scope OAuth to that mailbox only.
- **Send stays a human action.** Never auto-send about a child.
- Every message read and write is audited, and sealed on any list surface until
  a case reveal.

---

## 3. Definition of done (engineering)

In dependency order. Items 1-4 are the product; 5-8 are the "trust us with real
children and real money" layer.

1. **Access and tenancy foundation.** An `ADMIN` role; in-product user
   management (invite, manage, deactivate); SSO via WorkOS (the schema was built
   so this drops in without migration); MFA. Replaces the CLI-only provisioning.
   *(This slice is being built first — see status below.)*
2. **Customer provisioning and onboarding.** The silo environment factory
   above, plus a guided onboarding flow (create the trust and schools, invite
   the DSLs). *(Done — see §1 above and `docs/PROVISIONING.md`.)*
3. **Wonde production self-connect.** A "Connect Wonde" onboarding step,
   production credentials, per-tenant key storage in Secrets Manager, school
   selection. Replaces the operator-set environment key. *(Done — school
   selection self-connect is built; see the slice 3 note below.)*
4. **Email mission control.** Outbound send then inbound capture, as above.
   *(Phase 1 outbound is done — see the slice 4 note below; Phase 2 inbound is
   DPIA-gated and not started.)*
5. **Billing and metering.** Per-pupil usage metering plus the flat £50k MAT
   line; invoicing (Stripe or equivalent). None exists today.
6. **Proactive notifications.** DSLs alerted (email/push) the moment a serious
   signal is raised, not reliant on checking the dashboard.
7. **Rules engine tuning.** Move the five hardcoded rules to per-trust
   configurable thresholds (already flagged CTO-DECISION) and calibrate against
   real data with safeguarding leads.
8. **Production hardening.** Monitoring and alerting wired; tested backups and
   DR; a staging environment; error tracking (Sentry); multi-AZ Postgres; WAF;
   secrets rotation; independent penetration test and remediation; and an
   accessibility audit (WCAG 2.1 AA is claimed in DESIGN.md, not yet verified).

When 1-8 are complete and green, the honest statement is: "ready to sell,
pending CTO sign-off, legal and the Fieldfisher DPA framework."

---

## 4. Status

| # | Slice | State |
|---|-------|-------|
| 1 | Access and tenancy foundation | Done (in-product user management: an ADMIN role, invite/re-role/deactivate, soft deactivation that blocks sign-in, all audited). SSO/MFA remain as a follow-up. |
| 2 | Customer provisioning and onboarding | Done (silo factory: a Provision customer workflow parameterised per MAT, an idempotent audited `provisionCustomer` data layer, and a guided in-product onboarding flow — add schools, invite DSLs. The account-per-MAT vs prefixed-stack choice and DNS/TLS automation remain CTO-DECISIONs — see `docs/PROVISIONING.md`). |
| 3 | Wonde production self-connect | Done (in-product self-connect: a "Connect Wonde" onboarding step maps each school to its Wonde school from the schools the environment's token can reach, audited on link/unlink, reading only — never writing back to the MIS). The token itself is still set at the stack level (Secrets Manager); OAuth-style token capture in-app remains a CTO-DECISION — see the slice 3 note below. |
| 4 | Email mission control | Phase 1 done (outbound send: a human reviews a drafted referral/letter and sends it from the platform, threaded to the case; every message is written to an append-only, tenant-isolated communications timeline and the audit log — the machine drafts, the person sends, no auto-send). Phase 2 (inbound safeguarding-mailbox capture) is **not started and DPIA-gated** — see below. |
| 5 | Billing and metering | Not started |
| 6 | Proactive notifications | Not started |
| 7 | Rules engine tuning | Not started |
| 8 | Production hardening | Not started |

### Slice 3 note — Wonde self-connect: what's built, and the remaining edge

Wonde's model is one access token per application; schools approve the app, and
`GET /v1.0/schools` lists the ones the token can reach. Self-connect is built on
that: in onboarding, an admin maps each school (tenant) to its Wonde school from
the reachable list — validated against the live token, unique per school, and
audited on every link and unlink. The sync jobs then run against the linked
`wonde_school_id`; the platform only ever reads.

What remains a **CTO-DECISION** is how the *token itself* is supplied. Today it
lives in the stack's `<project>/wonde-api-key` secret (set by the operator, or
by Wonde app-approval, before onboarding), injected into the web and worker as
`WONDE_API_KEY`. A fuller self-serve flow would capture the token in-app —
either an OAuth-style Wonde authorisation or a paste-and-store that writes to
Secrets Manager — so no operator step is needed at all. The school-mapping half
(the part a DSL actually touches) is done; the token-capture half is the edge.

### Slice 4 note — email mission control: phase 1 shipped, phase 2 DPIA-gated

**Phase 1 (outbound) is built.** From a case, a DSL drafts a referral or letter,
reviews it, and sends it from the platform to the recipients they confirm. The
send goes through the mail transport (SES eu-west-2 in phase 1 — a verified
subdomain; phase 2 will send via the school's own connected mailbox), and the
message is written to an **append-only, tenant-isolated `CaseMessage`** timeline
threaded to the case, plus the audit log. A provider failure is recorded as a
FAILED message rather than lost. This is the "download and paste into Outlook"
step replaced by one audited click — the communication now lives in the system.
Human-in-the-loop is structural: there is no auto-send anywhere.

**Phase 2 (inbound capture) is not started, and is gated on Fieldfisher's
DPIA.** Connecting a school's dedicated safeguarding mailbox and surfacing
inbound mail against cases is the biggest special-category-data surface in the
product; per §2 it must be scoped into the DPIA at design time, not after. The
`CaseMessage` model already carries `direction` (INBOUND reserved), `threadId`
and `providerMessageId` so inbound threading drops onto the same record without
a migration.

This document is living: update the table and the slice sections as each lands.
