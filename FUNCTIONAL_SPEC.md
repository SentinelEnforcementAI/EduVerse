# FUNCTIONAL_SPEC.md — Sentinel Watch

## What this document is

CLAUDE.md tells you how to build. This tells you what to build.

The functional target is the interactive demo at `reference/watch-demo.jsx`. That file is 3,242 lines of working React and it is the source of truth for behaviour. Read it before writing code. If this document and the reference disagree, the reference wins on behaviour and this document wins on production concerns.

Parity means: same screens, same navigation, same actions, same outputs, same language. It does not mean copying the code. The demo hardcodes what production must compute. Section 3 covers that line precisely.

Definition of done for the product: every item in Section 12 is ticked and demonstrable.

---

## 1. Product in one paragraph

Watch reads school data across attendance, behaviour, attainment and pastoral records, links signals that individually look minor, and surfaces the pattern to the Designated Safeguarding Lead. The DSL decides. Watch then does the labour around that decision: drafts the letter or referral, files it, tracks the referral through the multi-agency process, keeps the compliance cycle current, and assembles the evidence when someone asks. Two tenancy modes: a single school, and a Multi-Academy Trust with school-level drill-down.

---

## 2. Non-negotiable behaviours

These are product principles, not preferences. Any slice that breaks one is wrong.

1. **Human confirms every consequential action.** Watch surfaces, proposes, drafts. A person confirms. Nothing that affects a child changes state without a human action. This includes document reading: Watch proposes an update, a person applies it.
2. **Identity is sealed until action is warranted.** A pupil shows as `Pupil 4471` until the case reaches the action threshold. Revealing requires a reason, and the reveal is written to the audit trail with that reason.
3. **Everything is audited.** Every reveal, dismissal, note, draft, filing, schedule, referral event and compliance change writes an append-only audit entry with actor, timestamp and reason where applicable. No hard deletes anywhere.
4. **No risk score on a child.** Escalation levels 1 to 4 describe the proportionate response, not the child. Never a numeric risk rating, never a league table of pupils.
5. **Watch never submits to an external body.** It prepares and pre-fills. The school submits. This applies to the section 175 return and to MASH referrals.
6. **UK English throughout.** Pupil not student. Signal not alert. DSL, MAT, Early Help, MASH. No em dashes in any generated document.

---

## 3. Demo versus production: read this before estimating

The demo fakes the engine. Every screen is real, the data behind it is not. This is the main reason a straight read of the demo underestimates the work.

| Surface | Demo | Production must |
|---|---|---|
| Case signals and timeline | Hand written array per case | Rules engine output over ingested Wonde data, each entry traceable to a source record |
| Narrative, interpretation, overall assessment | Pre written prose | LLM advisory layer over engine output, labelled as advisory, versioned prompt, logged call |
| Escalation level and recommended route | Static per case | Deterministic rules map signal combination to level; local threshold configuration per trust |
| Time to surface ("N days earlier") | Static map per case | Computed and defensible. Define the method once, document it, keep it consistent. This is a claim you make to investors and inspectors |
| KCSIE component statuses | Static per school | Derived from records: SCR entries, training completion dates, policy review date, s175 submission date |
| Document search ranking | Keyword and theme match on summary | Real search over document content. Embeddings optional, not required for parity |
| Document reading | Fixed sample text | Upload, parse, extract fields, propose, human applies |
| Referral state | In memory | Persisted lifecycle with events and timestamps |
| Pupil identities | Fictional map | Real pupils via Wonde, sealed by default, reveal gated and audited |

Everything else, meaning all navigation, layout, copy, panel behaviour and workflow, ports directly.

---

## 4. Global shell

**Entry.** Role selector offers two paths: single school, and Multi-Academy Trust. Selecting sets tenancy for the session. Strapline "Every child. Seen. Safe. Supported."

**Header.** Wordmark returns to overview. Right cluster: Inspection, Documents, On-call, Governance, and a role or tenant switch. Must wrap on narrow screens, not overflow.

**Footer.** KCSIE aligned, UK GDPR, data residency UK.

**Routing.** Ten top level views: `overview`, `school`, `cohort`, `triage`, `case`, `docs`, `kcsie`, `inspection`, `governance`, `oncall`. Breadcrumbs on every view below overview, each segment navigable.

**Panels.** Seven slide-in panels layered above the view: comms workflow, case file, review scheduler, termly report, document reader, KCSIE component workspace, document viewer. The document viewer must stack above the others, because it can be opened from within them.

**Toasts.** Every state-changing action confirms with a short toast.

**Responsive.** Case view collapses from two columns to one below 1000px. Grids collapse. Confidence column hides below 720px.

---

## 5. Screens

### 5.1 Trust overview (MAT tenancy)

Purpose: the trust safeguarding picture and where to look first.

Contains: trust KPI cards; a school-level table with each school's DSL, open concerns, KCSIE status and a pending-review indicator; cross-school pattern intelligence cards showing cohort level patterns that cross school boundaries.

Interactions: KPI card opens the matching triage list at trust scope. A school row opens that school's overview. A cross-school card opens the cohort view. KCSIE column opens trust compliance.

Acceptance: every school in the trust drills through to a fully populated school overview. No dead rows.

### 5.2 School overview

Purpose: the DSL's home screen.

Contains: date and time strip; four KPI cards (concern volume, active, closed, review pending or equivalent); pattern intelligence list of current cases with confidence and escalation level; KCSIE annual review card with status and "View compliance"; recent activity feed; concern volume trend chart.

Interactions: KPI card opens triage at school scope. A pattern row opens the case. The KCSIE card opens school compliance.

### 5.3 Cohort view

Purpose: a pattern that spans pupils, for example a year group or a cross-school cohort.

Contains: the cohort signal summary, a by-school breakdown where relevant, and "What Watch recommends".

Interactions: rows open individual cases.

### 5.4 Triage list

Purpose: the filtered working list behind every KPI card.

Contains: rows with sealed pupil reference, headline, escalation level chip, confidence, and status. Empty state copy where a category has no cases.

Interactions: row opens the case. Scope is trust or school depending on entry point.

### 5.5 Case view

The core screen. Two columns on desktop, main column left, context column right.

**Header.** Sealed pupil reference or revealed name, year group, school, headline, sub-headline, confidence, observation window, escalation level.

**Time to surface.** Banner stating how many days earlier Watch surfaced this than manual review would have. Method must be documented, see Section 3.

**What Watch sees.** The signal timeline. Each entry: date, label, source system (for example Attendance / SIMS, Behaviour / Bromcom, Pastoral / Watch entry), the observation, and a tone. Every entry must be traceable to an underlying record in production.

**Risk interpretation.** Per signal: the signal, its source, and what it means. This is the explainability surface. It is the reason a DSL trusts the output, so it is not optional.

**Watch's overall assessment.** Why these signals are linked, and why now.

**Recommended route and escalation.** Level 1 to 4, the route (for example pastoral review within 48 hours, parental contact, SENCO consultation, or MASH referral), and the rationale for that level rather than a higher or lower one. States that Watch re-assesses if new signals arrive.

**Take action.** Opens the comms workflow. Also: dismiss with reason, open case file, schedule pastoral review.

**Reveal pupil identity.** Only available at or above the action threshold (level 3, or any case marked serious). Requires a reason. Writes to audit.

**Case notes and collaboration.** Free text notes plus colleague tagging from the school directory.

**Documents.** Documents attached to this case, including anything Watch has drafted and filed. Sealed to the case.

**Referral.** Present when the case is level 4 or serious. Shows stage (submitted, chased, decided, re-referred), the current line, and an event mini-timeline. Stage-aware actions: record MASH response (opens the document reader), log a chase, re-refer with more information.

**Linked context.** Sibling, cohort, last DSL contact and similar. Where the link references another case, the row is clickable and opens it. Where it does not, no chevron and no click. The affordance must be honest.

**Scheduled reviews.** Any pastoral reviews booked on this case.

**Audit trail.** Every action on this case, in order, with actor and timestamp.

### 5.6 Comms workflow panel

Purpose: draft the communication the recommended route calls for.

Types: MASH referral, letter to parent, SENCO consultation, Early Help assessment, wellbeing referral, anti-bullying record, attendance letter, safeguarding chronology.

Behaviour: Watch drafts from the case chronology. Drafting state is visible. The DSL edits, then logs the action. On logging, the document is filed to the case documents and an audit entry is written.

Production note: the draft comes from the LLM layer with a versioned prompt and a logged call. A deterministic fallback must exist for every type so the workflow never dead-ends on an API failure.

### 5.7 Case file panel

Purpose: work the case.

Contains: recommended route, an action checklist that can be ticked through, and the case audit.

### 5.8 Review panel

Purpose: schedule a pastoral review.

Contains: time slot selection within a sensible window, attendee selection from the school directory, optional agenda note. On schedule, the review appears on the case and writes to audit.

### 5.9 Documents

Two buckets, deliberately separate.

**Org vault.** Policies, procedures, SCR, training records, certificates, governor reports, and everything Watch has generated. Browsable list.

**Case documents.** Sealed to the case, only reachable in-case, shown locked in search results.

**Contextual search.** The differentiator. Searching matches document content and themes, not filenames. A DSL types what they are looking for in plain language and gets the right document even when the title says nothing useful. Matched themes surface as chips on each result. There is a Watch summary above the results synthesising what was found.

**Inspection evidence pack.** One click, assembles the vault into a pack.

Acceptance: a plain language query with no filename words in it returns the right documents, and the result explains why it matched.

### 5.10 Document viewer panel

Renders any generated document with copy and download. Filename set. Opened from anywhere, including from inside other panels, so it stacks on top.

### 5.11 Document reader panel

Purpose: Watch reads an inbound document and proposes a record update. A person applies it.

Modes at parity: MASH response letter (proposes decision, rationale, next step) and training certificate (proposes course, completion date, expiry).

Behaviour: read, propose, show "Watch read this and proposes", human applies or discards. Explicit statement in the panel that Watch never updates a record on its own.

On apply: the record updates, the document files, audit written.

### 5.12 KCSIE compliance

**Trust scope.** Status table across all schools, trust compliance pack generation, rows open school scope.

**School scope.** Seven components, each with status (up to date, due, gap), detail and due date:

1. Safeguarding policy annual review
2. Staff read KCSIE Part 1
3. Single Central Record
4. DSL training, two yearly
5. Whole-staff safeguarding training
6. Governor safeguarding training
7. Section 175 self-assessment

Outputs: governor compliance pack, and a pre-filled section 175 for the school to review and submit to its local authority. Watch never submits.

Interactions: each component row opens its workspace. The DSL training row offers "update from certificate", which opens the document reader.

Important framing, keep it in the copy: there is no central KCSIE submission. KCSIE is statutory guidance. The annual cycle is policy review, staff reading, SCR, training, and the section 175 return to the local authority.

### 5.13 KCSIE component workspace panel

Purpose: get a component from amber to green, with someone accountable.

Contains: owner (SCR defaults to Office Manager, governor training to Safeguarding Governor, otherwise the DSL); tasks and reminders with add and tick; evidence list with attach-from-repository; activity log.

Reminders are in-app and due-date based. Email and push are roadmap, and the panel says so rather than implying they exist.

### 5.14 Inspection readiness

Purpose: one screen a DSL can walk an inspector through. Framed as evidence of practice, never as a report written for inspection.

Contains: stat row (days surfaced earlier than manual review, concerns surfaced this term, acted on, compliance status); the golden thread, a sample of cases each shown as concern, action, outcome with timeliness and a click through to the case; oversight and compliance pulled from the KCSIE module, trust aggregate or school detail; generate evidence pack.

Trust tenancy shows trust aggregate. Single school shows school level.

No framework self-score. No grade prediction. No new data collection for this screen.

### 5.15 Governance

Purpose: answer the data question before it is asked.

Contains: how Watch handles data, role-based access, privacy by design and built for inspection. In production this is where DPIA position, lawful basis, retention and the Children's Code stance belong.

### 5.16 On-call

Purpose: out of hours. Rendered as a phone view.

Contains: out of hours alerts, "safeguarding does not keep office hours", open case, exit on-call.

### 5.17 Termly report panel

Generates the termly governance report for the school or trust.

---

## 6. Data model, minimum viable

Derived from the demo objects. Names are indicative, shapes are not.

- **Tenant** (trust, school), every table carries tenant id, RLS enforced.
- **Pupil**: identifier, year group, school, sealed by default.
- **Signal**: date, domain (attendance, behaviour, attainment, pastoral, SEND), source system, observation, tone, link to underlying record.
- **Case**: reference, pupil, school, headline, sub, confidence, window, escalation level, route, rationale, status, opened date, detection metric.
- **Interpretation**: per signal, meaning text, source, generated or authored, provenance flag.
- **Note**: case, author, text, timestamp, tagged colleagues.
- **Document**: scope (org or case), case link, title, type, date, status, themes, summary, content, generated flag, source.
- **Referral**: case, stage, events with dates, decision.
- **Review**: case, datetime, attendees, agenda note.
- **ComplianceComponent**: school, label, status, detail, due date, owner, tasks, evidence document links, activity.
- **AuditEntry**: append only. Actor, action, subject, timestamp, reason. No deletes.
- **LlmCall**: prompt version, input hash, output, timestamp, case link. Advisory flag.

---

## 7. Escalation levels

| Level | Meaning | Typical route | Identity |
|---|---|---|---|
| 1 | Monitor | Watch continues, no action | Sealed |
| 2 | Emerging need | Pastoral review, parental contact, SENCO, Early Help | Sealed |
| 3 | Targeted support | Early Help lead, targeted support, possible external agency | Revealable |
| 4 | Statutory threshold | MASH referral, DSL leads, same day | Revealable |

Any case flagged serious is revealable regardless of level. Levels must be configurable per trust against their local safeguarding partnership thresholds. Do not hardcode thresholds in the engine.

---

## 8. Language and tone

Every string is professional and protective. No clinical diagnosis, no speculation about a child's home life stated as fact, no gamification, no engagement metrics on children. Signals are described as changes from a pupil's own baseline, not as traits.

Generated documents contain no em dashes.

---

## 9. Reliability

Every LLM-backed surface has a deterministic fallback that produces a complete, sensible output. Timeout, then fall back silently. A user must never see an error, a stack trace or an empty panel. This is a product requirement, not an optimisation.

---

## 10. Do not build

- Numeric risk scores or predictive risk ratings on children
- Any autonomous action affecting a child
- An agent creation or prompt configuration screen for end users
- LADO and allegations against staff, KCSIE Part 4, not yet
- A general attendance analytics module
- An Ofsted framework self-score or grade predictor
- Native mobile, geospatial, or anything in the CLAUDE.md exclusion list

---

## 11. Build order for parity

Reordered around user-visible slices. Infrastructure is still first, but every slice after slice 2 must produce something on screen.

0. Gap report. Read `reference/watch-demo.jsx` and this spec against the current repo. Produce a written inventory of what exists, what is partial and what is absent. No code.
1. Tenancy, RLS, synthetic seed, navigation shell, brand, role selector, header, footer, panel layering.
2. Wonde ingestion and the rules engine, per CLAUDE.md steps 4 and 5.
3. School overview and trust overview with drill-down.
4. Triage lists and the case view, read only.
5. Human-in-the-loop: reveal with reason, dismiss with reason, notes, colleague tagging, audit trail, audit viewer.
6. Comms workflow: drafting, editing, logging, filing to case documents.
7. Case file and pastoral review scheduling.
8. Documents: vault, case documents, contextual search, evidence pack.
9. Document reader: MASH response and training certificate, propose and apply.
10. Referral lifecycle.
11. KCSIE compliance, trust and school, compliance pack, section 175 pre-fill.
12. KCSIE component workspace.
13. Inspection readiness.
14. Governance, on-call, termly report.
15. LLM narrative layer across case narrative, interpretation, overall assessment, comms drafts and search synthesis. Advisory, versioned, logged, with fallbacks.

---

## 12. Parity checklist

Tick only when demonstrable in the running app against seeded data.

**Navigation**
- [ ] Both tenancy modes selectable at entry
- [ ] All ten views reachable
- [ ] Every trust school drills to a populated school overview
- [ ] Breadcrumbs navigable on every view
- [ ] All seven panels open, close, and layer correctly

**Case**
- [ ] Signal timeline with source attribution per entry
- [ ] Per signal interpretation
- [ ] Overall assessment
- [ ] Escalation level, route and rationale
- [ ] Time to surface figure, method documented
- [ ] Identity sealed by default, reveal gated by threshold, reason captured, audited
- [ ] Dismiss with reason, audited
- [ ] Notes and colleague tagging
- [ ] Linked context, clickable only where a real link exists
- [ ] Case audit trail complete

**Action**
- [ ] All eight comms types draft, edit, log and file
- [ ] Case file checklist
- [ ] Pastoral review scheduling with attendees
- [ ] Referral lifecycle: submitted, chased, decided, re-referred

**Documents**
- [ ] Org vault and sealed case documents, separately scoped
- [ ] Contextual search matching content not filenames, with matched themes shown
- [ ] Search synthesis summary
- [ ] Generated documents file back into the vault
- [ ] Inspection evidence pack

**Reading**
- [ ] MASH response read, propose, apply, file, audit
- [ ] Training certificate read, propose, apply, update compliance

**Compliance**
- [ ] Seven components with derived statuses
- [ ] Trust status table
- [ ] Governor compliance pack
- [ ] Section 175 pre-fill, school submits
- [ ] Component workspace: owner, tasks, evidence, activity

**Assurance**
- [ ] Inspection readiness, both scopes
- [ ] Governance screen
- [ ] On-call view
- [ ] Termly report

**Cross-cutting**
- [ ] Every state change writes audit, no hard deletes
- [ ] RLS proven by test on every table
- [ ] Every LLM surface has a working deterministic fallback
- [ ] UK English throughout, no em dashes in generated documents
- [ ] Responsive at 1000px and 720px

---

Authored by Tom Abbey, Founder and CEO, Sentinel Safeguarding Ltd.
