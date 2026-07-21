# CLAUDE.md — Sentinel Watch

## What this is
Sentinel Watch is a safeguarding intelligence platform for UK schools and Multi-Academy Trusts. It ingests school data (attendance, behaviour, attainment, pastoral) via Wonde, runs a hybrid risk engine (deterministic rules first, LLM second), and surfaces signals to Designated Safeguarding Leads (DSLs). It is an overlay on existing systems (CPOMS, MyConcern, MIS platforms), not a replacement.

This build targets the design partner MVP: two schools (Downlands, Patcham), real workflows, synthetic data until a signed DPA says otherwise.

## Non-negotiable principles
1. **Human-in-the-loop is structural.** The system flags. Humans decide. No feature may auto-action anything consequential about a child. Every flag requires explicit DSL confirmation, dismissal, or escalation. This is enforced in code and schema, not UI copy.
2. **UK data residency.** All data and inference stays in AWS London (eu-west-2). No pupil data leaves UK infrastructure. LLM calls via UK-resident endpoints only.
3. **Explainability.** Every signal must carry its reasoning: which rule fired or what pattern the LLM identified, with the underlying data points. No unexplained scores.
4. **Full audit.** Every read and write against a child's record is logged: who, what, when, why. Audit log is append-only. Safeguarding records are never hard-deleted — soft delete only, with audit entry.
5. **Overlay-first.** Read from source systems via Wonde. Never write back to the MIS.

## Stack (decided — do not substitute)
- **Frontend:** Next.js (App Router) + React + TypeScript + Tailwind + shadcn/ui
- **API:** tRPC (type safety across the stack)
- **Database:** PostgreSQL with row-level security for multi-tenancy. One database, tenant_id on every table, RLS policies enforced at the DB layer — not just application code
- **ORM:** Prisma
- **Cache/queues:** Redis
- **Ingestion:** Wonde API (sandbox first). Attendance, behaviour, attainment, students, contacts
- **Risk engine:** Deterministic rules engine (versioned, auditable) + Anthropic Claude for pattern narrative. Rules always run first. LLM output is advisory and labelled as such
- **Auth:** Email magic link for MVP, structured so WorkOS/school SSO can replace it later without schema change
- **Local dev:** Docker Compose (Postgres, Redis)
- **Hosting target:** AWS eu-west-2. Do not deploy anywhere else
- **CI:** GitHub Actions — lint, typecheck, test on every PR

Do NOT add: React Native/Expo, PostGIS, PGRouting, MapLibre, Python services, or any native mobile target. Mobile-responsive web only in Phase 1.

## Data rules
- Development uses synthetic pupil data only. Generate a realistic seed dataset (2 schools, ~800 pupils each, 12 months of attendance/behaviour/attainment with embedded risk patterns for testing the engine).
- Never commit real pupil data, Wonde production keys, or any secrets. .env only, .env.example committed.
- All tables carry tenant_id (school/trust). RLS policies written and tested for every table.

## Build workflow
- Work in vertical slices, one PR per slice. Each slice = schema + API + UI + tests, shippable on its own.
- Migrations via Prisma Migrate. Never edit a committed migration.
- Every slice includes tests: unit tests for the rules engine (mandatory, every rule), integration tests for tRPC routes, RLS tests proving tenant isolation.
- Definition of done: typecheck clean, lint clean, tests pass, RLS verified, audit entries written for the slice's actions.
- Anything you are unsure about architecturally: stop and flag it as a decision, do not guess. Decisions reserved for the incoming CTO are marked `CTO-DECISION` in comments — implement the simplest working version and mark it.

## Build order (do not reorder without asking)
1. Scaffold: monorepo, Next.js, tRPC, Prisma, Docker Compose, CI, auth shell
2. Tenancy + RLS foundation with tests
3. Synthetic data generator + seed
4. Wonde ingestion (sandbox): students, attendance, behaviour, attainment — idempotent sync jobs via Redis queue
5. Rules engine v1: versioned rule definitions, execution log, 5 starter rules (attendance drop, behaviour spike, attainment decline, cross-domain correlation, sustained absence pattern)
6. Signal surface: DSL dashboard — flagged pupils, signal detail with full reasoning and underlying data
7. Human-in-the-loop workflow: confirm / dismiss / escalate, with notes, all audited
8. Audit log viewer
9. LLM narrative layer (advisory summaries on confirmed signals only)

## Tone and conventions
- UK English throughout the product (behaviour, safeguarding, colour)
- Terminology: pupil (not student), DSL, signal (not alert), flag, MAT
- No dark patterns, no gamification, no engagement metrics on children
