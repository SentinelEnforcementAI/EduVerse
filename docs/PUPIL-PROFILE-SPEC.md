# Pupil profile & case workspace — combined spec

Distilled from two design mocks (the "Student Intelligence Profile" and the
"Case Workspace"), filtered through Sentinel's non-negotiables. This is the
reference for the case-workspace enrichment and the (future) standalone pupil
screen.

## Guardrails (these override any mock)

- **Pupil, not student.** UK safeguarding language throughout.
- **No numeric risk score on a child.** The mocks' `72/100` gauge and
  per-factor sub-scores are out. We use **escalation levels 1–4** with the
  reasoning attached. A domain "risk factor" carries the *level* of the signals
  behind it and the *evidence* — never a number.
- **No invented data.** We only show domains that have real evidence. We never
  render a "Family: Low — no concerns" row to fill the grid.
- **Sealed identity by default.** Identity (name, and the personal snapshot) is
  sealed to `Pupil NNNN` until a case reaches level ≥3 or serious *and* a reveal
  is recorded with a reason. Statutory **context flags are non-identifying**, so
  they show even while sealed.
- **No child photo by default.** Wonde can supply one; it stays behind the
  reveal, if used at all.
- **Full audit.** Every record read is logged (`case.viewed`), every reveal is
  logged with its reason.

## Panel → data source map

| Panel | Source | Sealed? | Status |
|---|---|---|---|
| Safeguarding context flags (FSM, PP, SEN, EAL, CLA, Young carer, Service child, Medical) | Wonde pupil attributes | Shown while sealed (non-identifying) | **Built** |
| Pupil snapshot (preferred name, DOB/age, tutor, house, admission, first language, ethnicity) | Wonde pupil attributes | Revealed only | **Built** |
| Domain risk-factor breakdown (per-domain level + evidence) | Derived from the pupil's signals (`reasoning.dataPoints[].src`) | Follows the case | **Built** |
| Case lifecycle stepper (Raised → File opened → Reviewed → Referred → Closed) | Derived from `Signal.status`, case file, `Referral.stage` | n/a | **Built** |
| Linked / case documents | Our document vault (`Document`, case-scoped) | Sealed metadata | Pre-existing; kept |
| Chronology / "what Watch sees" timeline | `Signal.reasoning.dataPoints` | Follows the case | Pre-existing |
| Communication log | `CaseMessage` | Sealed | Pre-existing |
| Evidence / notes | `CaseNote` | Sealed | Pre-existing |
| Assigned actions / case-file checklist | `CaseTask` | Sealed | Pre-existing |
| Meeting schedule / pastoral review | `CaseReview` | Sealed | Pre-existing |
| Referral lifecycle | `Referral` / `ReferralEvent` | Reveal-gated | Pre-existing |
| Attendance / behaviour charts | Wonde `AttendanceRecord` / `BehaviourIncident` | Follows the case | Aggregates exist; richer charts = future |
| Intervention plan + outcomes ("progress to goals") | **New data model, not Wonde** | — | Future slice |
| Wellbeing survey / sleep / stress (self-reported) | **Not Wonde** — needs a pupil-voice tool | — | Out of scope; do not imply we have it |

## What this release shipped (case workspace)

- `Pupil` schema: statutory context flags + snapshot fields (nullable migration;
  RLS inherited).
- Synthetic generator + seed populate them at national-ish rates from a separate
  deterministic stream (event data unchanged); hero cases carry a curated,
  story-coherent picture (disclosure = PP+FSM; cross-domain = PP+SEN+ADHD;
  welfare = PP+FSM+young carer).
- `casework.case` returns `context` (always), `snapshot` (reveal-only),
  `riskFactors` (derived), `lifecycle` (derived).
- Case page: context flag strip, lifecycle stepper, risk-factor breakdown,
  reveal-gated snapshot panel.
- Tests: `case-insight` unit (factors + lifecycle), sealing integration (context
  shown sealed, snapshot withheld until reveal), generator cohort rates.

## Deliberately deferred

- **Standalone pupil profile route** (`/pupil/[id]`) — the mocks' full profile
  page. Net-new route + nav + its own sealing story; larger than this slice.
- **Intervention plan + outcome tracking** — new schema; genuinely useful but not
  Wonde-derived.
- **Richer attendance/behaviour charts** (authorised vs unauthorised split,
  persistent-absence %, day-of-week) — the data is in Wonde; presentation is the
  work.
