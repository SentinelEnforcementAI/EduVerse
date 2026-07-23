# Gap report — current repo vs FUNCTIONAL_SPEC.md

Written against `FUNCTIONAL_SPEC.md` and `reference/watch-demo.jsx` at the state
of `main` after the production bootstrap. No code was written for this report.

**Headline:** the current build is spec build-order steps 1, 2, and partial 3–5
— the safeguarding *spine* (tenancy + RLS, ingestion, rules engine, a signal
list, a signal detail with reasoning, confirm/dismiss/escalate, audit, advisory
AI narrative). Of the 17 screens and panels in section 5, **2 are partial and
15 are absent.** The entire action half of the product — comms, documents,
reading, referral, KCSIE compliance, inspection, governance, on-call — does not
exist. Two spec principles are actively violated by the current build and must
be corrected, not just extended: **identity is never sealed** (principle 2), and
the UI still surfaces a **numeric severity** on a pupil (principle 4).

The demo is 3,242 lines implementing all 10 views and all 7 panels
(components confirmed present: `TrustOverview`, `SchoolOverview`, `CohortView`,
`TriageList`, `CaseView`, `DocsView`, `KcsieView`, `InspectionView`,
`Governance`, `OnCall`; panels `Workflow`, `CaseFilePanel`, `ReviewPanel`,
`ReportPanel`, `DocPanel`, `DocReadPanel`, `KcsieWorkspacePanel`).

---

## 1. Screens and panels (spec section 5)

| # | Screen / panel | Status | Evidence |
|---|---|---|---|
| 5.1 | Trust overview (MAT) | **Absent** | Tenancy is flat (`model Tenant`, single `tenantId` per user). No MAT hierarchy, no trust rollup, no school table. |
| 5.2 | School overview | **Partial** | `apps/web/src/app/dashboard/page.tsx` has KPI stat cards + data-sync card + system-status. Missing: pattern-intelligence case list w/ confidence + escalation, KCSIE annual-review card, recent-activity feed, concern-volume trend chart, date/time strip. |
| 5.3 | Cohort view | **Absent** | No cross-pupil / year-group pattern view or route. |
| 5.4 | Triage list | **Partial** | `dashboard/signals/page.tsx` lists signals with status tabs + severity band + pupil name. Missing: **sealed pupil reference**, escalation-level chip (1–4), confidence column, per-category empty-state copy, trust/school scope. |
| 5.5 | Case view | **Partial** | `dashboard/signals/[id]/page.tsx` + `decision-panel.tsx` + `narrative-panel.tsx`: headline, "why this fired" summary, metrics, underlying records, confirm/dismiss/escalate, AI narrative (confirmed only), decision history. Present: ~2 of 13 surfaces. **Missing:** sealed identity + gated reveal, time-to-surface banner, per-signal interpretation with source system, recommended route + escalation level + rationale, take-action comms entry, case notes + colleague tagging, case documents, referral block, linked context, scheduled reviews, a first-class case audit trail. |
| 5.6 | Comms workflow panel | **Absent** | No drafting panel. Eight comms types unbuilt. |
| 5.7 | Case file panel | **Absent** | No action-checklist panel. |
| 5.8 | Review panel | **Absent** | No pastoral-review scheduler. |
| 5.9 | Documents (vault + case + contextual search) | **Absent** | No `Document` model, no docs view, no search. |
| 5.10 | Document viewer panel | **Absent** | No generated-document render/download. |
| 5.11 | Document reader panel | **Absent** | No inbound read → propose → apply flow. |
| 5.12 | KCSIE compliance (trust + school) | **Absent** | No `ComplianceComponent` model, no seven-component view, no s175 pre-fill. |
| 5.13 | KCSIE component workspace panel | **Absent** | No owner/tasks/evidence/activity workspace. |
| 5.14 | Inspection readiness | **Absent** | No golden-thread screen or evidence pack. |
| 5.15 | Governance | **Absent** | `app/page.tsx` is a marketing landing page, not the governance data screen (data handling, RBAC, privacy-by-design). |
| 5.16 | On-call | **Absent** | No out-of-hours phone view. |
| 5.17 | Termly report panel | **Absent** | No termly governance report generator. |

---

## 2. Parity checklist (spec section 12)

| Group | Item | Status | Note |
|---|---|---|---|
| Navigation | Both tenancy modes at entry | **Absent** | No role selector; session tenancy is fixed to the user's one school. |
| Navigation | All ten views reachable | **Absent** | ~4 routes exist (overview, signals list, signal detail, audit). |
| Navigation | Trust school drills to populated overview | **Absent** | No trust tier. |
| Navigation | Breadcrumbs navigable | **Absent** | None. |
| Navigation | Seven panels open/close/layer | **Absent** | Two inline sub-components (`decision-panel`, `narrative-panel`), not slide-in layered panels. |
| Case | Signal timeline w/ source attribution | **Partial** | "Underlying records" list exists; no source-system labelling (Attendance/SIMS etc.), no tone. |
| Case | Per-signal interpretation | **Absent** | Only a single overall "why this fired" summary. |
| Case | Overall assessment | **Partial** | AI narrative, but only after confirm, and with no deterministic fallback. |
| Case | Escalation level, route, rationale | **Absent** | Numeric `severity` only; no 1–4 level, route, or rationale. |
| Case | Time to surface, method documented | **Absent** | Not computed or shown. |
| Case | Identity sealed by default, gated reveal, reason, audited | **Absent** | **Principle violation:** pupil full name shown everywhere, always. |
| Case | Dismiss with reason, audited | **Built** | `decideSignal` DISMISS requires a note ≥5 chars, audited. |
| Case | Notes + colleague tagging | **Absent** | No notes model or UI. |
| Case | Linked context, honest affordance | **Absent** | None. |
| Case | Case audit trail complete | **Partial** | `AuditEvent` + decision history exist; not surfaced as a per-case ordered trail. |
| Action | Eight comms types draft/edit/log/file | **Absent** | — |
| Action | Case file checklist | **Absent** | — |
| Action | Pastoral review scheduling | **Absent** | — |
| Action | Referral lifecycle | **Absent** | No `Referral` model. |
| Documents | Vault + sealed case docs | **Absent** | — |
| Documents | Contextual search (content not filename) + themes | **Absent** | — |
| Documents | Search synthesis summary | **Absent** | — |
| Documents | Generated docs file back to vault | **Absent** | — |
| Documents | Inspection evidence pack | **Absent** | — |
| Reading | MASH response read/propose/apply/file/audit | **Absent** | — |
| Reading | Training certificate read/propose/apply | **Absent** | — |
| Compliance | Seven components, derived statuses | **Absent** | — |
| Compliance | Trust status table | **Absent** | — |
| Compliance | Governor compliance pack | **Absent** | — |
| Compliance | Section 175 pre-fill | **Absent** | — |
| Compliance | Component workspace | **Absent** | — |
| Assurance | Inspection readiness, both scopes | **Absent** | — |
| Assurance | Governance screen | **Absent** | — |
| Assurance | On-call view | **Absent** | — |
| Assurance | Termly report | **Absent** | — |
| Cross-cutting | Every state change audits, no hard deletes | **Partial** | True for decisions + narratives; no soft-delete pattern proven, most write paths don't exist yet. |
| Cross-cutting | RLS proven by test on every table | **Partial** | RLS tests exist for tenancy + pupil-data + append-only tables; new spec tables (Document, Referral, etc.) don't exist. |
| Cross-cutting | Every LLM surface has deterministic fallback | **Absent** | **Principle-9 violation:** narrative generation throws on Bedrock failure; no fallback. |
| Cross-cutting | UK English, no em dashes in generated docs | **Partial** | UK English largely holds; no generated-document layer to check em dashes against yet. |
| Cross-cutting | Responsive at 1000px and 720px | **Unverified** | Not built/tested against the case two-column collapse. |

---

## 3. In the repo, not in the spec (keep / drop decisions)

- **Auth: invite-only magic link + sessions + SES email** (`server/auth/*`). Not
  in the spec's shell (spec entry is a role selector), but a real production
  concern the spec omits. **Keep** — the role selector layers on top.
- **Wonde sync status card + `SyncRun` surfacing** (dashboard). Infra visibility,
  not a spec screen. **Keep** (fold into school overview activity later).
- **System-status health-ping card** (`system-status.tsx`). Dev artifact, not in
  spec. **Drop** during the school-overview slice.
- **Marketing landing page** (`app/page.tsx`, "See risk sooner"). Not the spec's
  entry. **Repurpose** — entry becomes the role selector (section 4).
- **Numeric `severity` (1–3) on `Signal`** + severity-band UI. **Conflicts with
  principle 4** (no numeric risk score on a child). Must be reframed to
  escalation levels 1–4 as *proportionate response*, surfaced as level chips, not
  a number on the pupil. Internal engine scoring can stay; the pupil-facing
  number must go.
- **Deploy / bootstrap / logs / run-rules workflows + `infra/terraform`.** Not in
  spec; production plumbing. **Keep.**

---

## 4. The five largest pieces of work, by effort

1. **Case view to full parity (5.5).** The core screen — thirteen distinct
   surfaces, and the spec + parity prompt both single it out as the one that gets
   under-built. Includes the sealed-identity/reveal mechanic that ripples into
   every pupil-facing surface. **XL.**
2. **Documents: vault + sealed case docs + contextual search + viewer + reader
   (5.9–5.11).** New `Document` model, real content/theme search with a synthesis
   summary (filename matching is explicitly worthless here), upload/parse, and
   read→propose→apply. **XL.**
3. **KCSIE compliance + component workspace + s175 pre-fill + inspection
   readiness (5.12–5.14).** New `ComplianceComponent` model, seven derived
   statuses, trust + school scope, pack generation, golden-thread screen. **L–XL.**
4. **MAT tenancy + trust overview + cohort + drill-down (5.1, 5.3).** Schema
   change from flat to nested tenancy (trust → schools), role selector, trust
   rollup and cross-school pattern cards. Touches RLS on every table. **L.**
5. **Comms workflow (eight types) + referral lifecycle (5.6, 5.10) + the LLM
   advisory layer with deterministic fallbacks across every generated surface
   (15).** Draft/edit/log/file, persisted referral events, versioned prompts,
   logged calls, and a complete fallback for each type so nothing dead-ends. **L.**

Cross-cutting reframes that are not optional and land inside the slices above:
**seal identity by default with a gated, audited reveal**; **replace the pupil-
facing numeric severity with escalation levels 1–4**; **give every LLM surface a
deterministic fallback**.

---

## Recommended entry point

Spec build order (section 11) is already sequenced sensibly. Given what exists,
the highest-leverage first slice is **step 3 — school overview and trust overview
with drill-down** (makes the app feel populated and forces the tenancy reframe
early), immediately followed by **step 4 — triage + case view read-only** and
**step 5 — the human-in-the-loop reframe** (sealed identity, reveal, notes,
tagging), which is where the current build is closest and most wrong at the same
time. One slice per session, parity checked against the demo, per PARITY_PROMPT.
