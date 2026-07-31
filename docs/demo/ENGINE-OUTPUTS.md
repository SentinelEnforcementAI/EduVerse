# What the engine actually outputs (and how to read it)

A plain-English calibration read for the demo and for investor Q&A: what the risk
engine looks at, why its signals aren't noise, how they map to a proportionate
response, and how we tune it. Grounded in the shipped rules
(`packages/rules/src/rules/*`) and the synthetic demo roll.

> This is the honest "understand the outputs" companion to the demo. On the
> synthetic schools the patterns are engineered so they fire cleanly and the
> story lands; on a real school the same engine runs and the thresholds get
> tuned to that school's own distribution (last section).

---

## Two layers, in order

1. **Deterministic rules first.** Five versioned, auditable rules run over the
   pupil's own history. Each fires only when a change clears an explicit
   threshold *against that pupil's own baseline* — not a population percentile,
   not a black box. Every signal carries its data points and the threshold it
   crossed. This is what a DSL (and an inspector) can interrogate.
2. **LLM advisory second, and clearly labelled.** On a confirmed signal the LLM
   writes a plain-English narrative — advisory only, never a decision, never a
   score, with deterministic fallbacks so a user never sees an error. It reads
   pseudonymised data. It cannot action anything.

**No risk score on a child.** A signal has a *severity* (1–3) used only to order
a DSL's queue, and maps to an *escalation level* (1–4) describing the
proportionate response — monitor, emerging need, targeted support, statutory
threshold. Never a number on a child, never a league table.

---

## The five rules — what fires, and why it isn't noise

Every rule compares a **recent window** to the pupil's **own baseline** and has
floors that suppress false positives. Defaults below (all overridable per trust).

| Rule | Fires when… | Key thresholds (default) | Severity scales with | Why it's not noise |
|---|---|---|---|---|
| **Attendance drop** | Recent attendance falls sharply vs the pupil's own recent history | last **28d** vs prior **84d**; drop **≥15pp**; recent rate **≤85%**; needs **≥16** recent / **≥30** baseline sessions | ≥30pp → 3, ≥22pp → 2 | Compares a pupil to *themselves*; the min-sessions floors stop a handful of days triggering it; the ≤85% gate ignores pupils who are simply always-present with one odd week |
| **Behaviour spike** | A cluster of incidents well above the pupil's own prior rate | last **42d** vs prior **90d**; **≥4** recent incidents; **≥2.5×** the baseline monthly rate | severity-weighted volume: ≥14 → 3, ≥8 → 2 | The ratio-to-baseline means a generally-boisterous pupil doesn't constantly fire; it's the *change* that matters |
| **Attainment decline** | Marks fall materially across more than one subject | **≥8-point** drop in **≥2** subjects (each with ≥2 assessments) | avg decline ≥18 → 3, ≥12 → 2 | Requires breadth (≥2 subjects) so one hard test in one subject doesn't trigger it |
| **Cross-domain** *(the flagship)* | Milder shifts line up **across domains at the same time** | needs **≥2 of**: attendance drop ≥**8pp**, ≥**3** recent incidents (30d), ≥**5**-pt score decline | 3 domains → 3, else 2 | Each shift may sit *below* its own single-domain threshold — the **correlation** is the signal. This is the pattern a human juggling four systems misses |
| **Sustained absence** | One weekday is habitually missed while others stay normal | 12-week window; a weekday missed often, other weekdays low | rate ≥75% & ≥10 occurrences → 3, else 2 | The "other weekdays normal" test is what separates "misses every Monday" from general poor attendance |

**The point to make in the demo:** three of these (attendance, behaviour,
attainment) are things a school *could* eventually notice on their own. The
**cross-domain** rule is the one that earns the product — it catches the child
whose signals are individually below every threshold but point the same way.

---

## From signal to proportionate response (levels 1–4)

A signal's severity and `serious` flag map to an escalation **level** that
describes the *response*, and gates whether identity can be revealed:

| Level | Meaning | Typical route | Identity |
|---|---|---|---|
| 1 | Monitor | engine keeps watching, no action | sealed |
| 2 | Emerging need | pastoral review, parental contact, SENCO, Early Help | sealed |
| 3 | Targeted support | Early Help lead, targeted support, possible external agency | revealable (with a logged reason) |
| 4 | Statutory threshold | MASH referral, DSL leads, same day | revealable (with a logged reason) |

A `serious` signal (e.g. an online-safety disclosure) is Level 4 regardless of
the numeric severity.

---

## What fires on the synthetic demo roll

Each synthetic school (~800 pupils, 12 months of data) carries five deliberately
embedded patterns — the engine's ground truth — at roughly:

- attendance-drop ≈ 12 / 800
- behaviour-spike ≈ 12 / 800
- attainment-decline ≈ 11 / 800
- **cross-domain ≈ 10 / 800** (deliberately well-represented — the flagship, not a rarity)
- sustained-absence ≈ 10 / 800

So a school surfaces on the order of a few dozen open concerns from ~800 pupils —
a *triageable* number, not a wall. The seed then works ~half of them through
realistic decisions (some dismissed with notes, some confirmed, some escalated,
the rest awaiting a decision) so the overview reads like a live caseload. Three
hand-built **hero cases** sit on the flagship school (Downlands) and stay open to
carry the walkthrough:

- **Online safety disclosure** — Level 4, 3 signals / 2 systems, surfaced 5 days out, 2 out-of-hours.
- **Attendance and behaviour pattern** — cross-domain, 5 signals / 3 domains, surfaced 9 days out.
- **Welfare and presentation pattern** — Level 3 (Early Help), 3 signals, surfaced 10 days out, attendance 88%.

**Above the schools**, the trust layer computes cross-school cohort patterns
(e.g. a correlated Year-9 attendance dip across several schools that's inside
normal range at any one school) — intelligence that only exists at the trust
level.

---

## Time to surface (the headline metric)

For each signal the engine records **days to surface**: how far ahead of the
school's own next scheduled review cycle the pattern was flagged. It's computed
from when the signals existed in the source data versus the cadence of the
review — a defensible method, not a slogan. Quote it as "days before the next
scheduled review would have connected these," and be ready to show the rules.

---

## Calibration — how we control false positives and tune to a school

The levers are already in the product (`/dashboard/admin/rules`, per-trust
`RuleConfig` overrides — no code change to retune):

- **Baseline-relative, not absolute.** Every rule compares a pupil to their own
  history, so a school with structurally lower attendance doesn't drown in flags.
- **Floors suppress thin data** — min recent/baseline sessions, min subjects, min
  incidents — so a few data points never trigger a signal.
- **Correlation over volume** — the cross-domain rule needs agreement across
  domains, which is inherently specific.
- **Per-trust thresholds** — every number above is overridable per trust, so we
  calibrate to the real distribution once a school is connected.

**What real (design-partner) data will teach us:** the right thresholds for a
given school, the true base rate of each pattern, and the false-positive rate a
DSL will tolerate. The synthetic roll validates the *mechanism*; a connected
school calibrates the *numbers*. That's the loop — connect, watch a term, tune
the per-trust config to the DSL's judgement of what's worth surfacing.
