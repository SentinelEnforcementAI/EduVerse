# Sentinel Watch — Investor Demo Run-Sheet

A benefit-led walkthrough for the Symvan (pre-seed / SEIS) call. This is **not**
a tour of screens or a wall of alerts. It's a story: the problem, a child who
would have been missed, the DSL staying in control, the labour the system takes
off their plate, and the proof it runs on real school data — closing on the
trust and safety that make a Multi-Academy Trust actually buy.

> Read the arc first, then the act-by-act script. Each act has **SAY** (the line,
> benefit-first), **DO** (the click), and **SO WHAT** (the proof point to land).
> Keep moving — the story carries; the screens are evidence, not the point.

---

## The arc (six acts, ~8–10 minutes)

0. **The problem** — safeguarding leads are flying blind across four systems.
1. **See the whole trust** — the view no MAT has today.
2. **The child who'd be missed** — five minor signals, three systems, one pattern.
3. **The DSL is in control** — explainable, sealed, human decides.
4. **The labour around the decision** — draft the referral, file it, track it.
5. **It's real** — a live school connected via Wonde, running through the same engine.
6. **Why a trust says yes** — audit, residency, no score on a child. The moat.

**The 20-second hook (say this before you touch anything):**

> "Every school already holds the data that shows a child is in trouble —
> attendance, behaviour, attainment, pastoral notes. The problem is it's
> scattered across four systems and three people, and no one is watching all of
> it at once. Sentinel Watch reads what the school already has, connects the dots
> a busy safeguarding lead can't, and surfaces the child who needs attention —
> with the reasoning attached — days before the next meeting would have caught
> it. The system flags. A human always decides."

Strapline on screen: **"Every child. Seen. Safe. Supported."**

---

## Pre-flight

- **URL:** the live app (AWS eu-west-2). Have it open and signed out.
- **Accounts (magic-link, invite-only):**
  - Director: `director@weald-learning-trust.example` — whole trust.
  - DSL: `dsl@downlands.example` — Downlands only (role boundary enforced at the
    database, not hidden in the UI — worth saying out loud).
  - Admin: for the Wonde-connection act.
- **Reset before the call:** run the Reset demo workflow (Actions → *Reset demo
  data*) so the caseload is pristine and no earlier click is still on screen.
- **Demo environment:** **Weald Learning Trust** — five schools, a synthetic roll
  with real risk patterns embedded, plus one genuinely **live** school connected
  via Wonde. Quote pupil/concern counts from the live instance (see *Numbers*).
- **Have a second tab** on `/dashboard/audit` and the Wonde connect screen so
  Act 4 and Act 5 don't stall on navigation.

**The sandbox school — how to hold it.** The Wonde-connected school ("Wonde
Sandbox School") is a live *test-data* connection: its **roll is real and live**,
but its event data is generic MIS test data with no engineered safeguarding
story, so any concerns on it are not the narrative. Drive Acts 1–4 on the
**synthetic schools** (Downlands etc.) where the patterns are legible, and use
the sandbox only in **Act 5** as the "it's real" proof — via the **Admin →
Connect Wonde** screen and its live roll count. Don't drill into the sandbox
school's own concern list on stage. (A full data-level tidy of that tenant is a
safe follow-up; it isn't needed for the story.)

**One honesty note you can volunteer if asked** (it builds credibility): the
synthetic schools carry an *engineered* safeguarding story so the pattern is
legible in a 10-minute demo; the connected Wonde school proves the *pipeline* on
real data. Same engine over both. Nothing on screen is faked — the reasoning,
the time-to-surface and the escalation are computed, not typed.

---

## Act 0 — The problem (30 seconds, before the app)

**SAY:**
> "Picture the Designated Safeguarding Lead at one of these schools on a Monday.
> Attendance is in SIMS. Behaviour is in Bromcom. Pastoral notes are on paper or
> in CPOMS. A TA heard something in the corridor. Each of those, on its own,
> looks minor — so nothing happens. The child who's actually in trouble is the
> one whose signals are spread thin across all of them. Today, catching that
> depends on one overloaded person happening to connect it. When they don't,
> it's a serious case review and an Ofsted failure. That's the gap we close."

**SO WHAT:** frame the category — this is *safeguarding intelligence*, not
another MIS or another alerts inbox. The enemy is fragmentation.

---

## Act 1 — See the whole trust (`/dashboard/trust`)

**DO:** Sign in as the **Director**. Land on the trust overview.

**SAY:**
> "This is the view no Multi-Academy Trust has today. One person accountable for
> safeguarding across five schools, seeing all of it at once — caseload,
> escalations, and where the pressure is. But here's the part a single school
> literally cannot see."

**DO:** Scroll to **Cross-school pattern intelligence** (also `/dashboard/insights`).

**SAY:**
> "Sentinel spotted a correlated dip in Year 9 attendance across four of the five
> schools in the same fortnight. At any one school it sits inside the normal
> range — invisible. Across the trust, it's a pattern big enough to have a shared
> cause: a transport change, something on social media. The system's telling the
> trust to look once, centrally, before five schools each waste a fortnight
> chasing it separately."

**SO WHAT:** **Cross-school intelligence is a capability that only exists at the
trust layer.** No MIS and no single-school tool can produce it. This is the wedge
into MATs — the buyer with budget and a board-level safeguarding duty.

---

## Act 2 — The child who'd be missed (`/dashboard/school/<downlands>` → the case)

**DO:** Drill into **Downlands**. Open the concern titled **"Attendance and
behaviour pattern."**

**SAY:**
> "Here's one child. Look at what surfaced it: **five signals, across three
> different systems, over one fortnight.** Three missed periods with no
> explanation — that's SIMS. A note that they were quieter than usual in form
> group — pastoral. Two minor incidents in PE — Bromcom. A concentration concern
> from SEND. And they mentioned home stress to a teaching assistant. Not one of
> those trips a threshold on its own. **No human was watching all three systems.
> Sentinel was — and it surfaced this nine days before the next scheduled meeting
> would have connected it.**"

**DO:** Point to the **time-to-surface banner** at the top of the case.

**SAY:**
> "That number — days to surface — is the whole product in one line. Nine days
> earlier, on this child. Weeks earlier on attendance-only cases. That's time a
> DSL uses to actually help, instead of reacting after a crisis."

**SO WHAT:** **Cross-domain correlation + time-to-surface.** This is the core
capability and the core benefit in a single screen. It's a *child*, not a chart.

---

## Act 3 — The DSL is in control (same case view)

**SAY:**
> "Now — this is where most people expect an AI to make a call about a child. It
> doesn't, and that's deliberate."

**DO:** Walk down **"What Watch sees"** (the signal timeline with sources) →
**"Risk interpretation"** → **"Watch's overall assessment"** → **"Recommended
route."**

**SAY:**
> "Every signal shows where it came from and why it matters — nothing is a black
> box. The DSL gets the whole picture in one place instead of five logins. And
> the pupil's identity is **sealed** — you're looking at *Pupil 4471*, not a
> name. To reveal it, you have to give a reason, and that reason is written to the
> audit log. Identity unlocks only when the case actually warrants it."

**DO:** Point to the **decision panel** (Confirm / Dismiss / Escalate) — don't
action it yet.

**SAY:**
> "And the decision sits here, with the human. Sentinel never closes a case,
> never reveals a name on its own, and — this matters to every DSL we've spoken
> to — **never puts a risk score on a child.** The escalation levels describe the
> proportionate response, one to four. Never a number, never a league table of
> pupils."

**SO WHAT:** **Explainability + sealed identity + human-in-the-loop, enforced in
schema not UI copy.** This is the trust story. In safeguarding, "we have an
algorithm" is a liability; "we surface, a person decides, everything's logged" is
a sale.

---

## Act 4 — The labour around the decision (the serious case)

**DO:** Go to Downlands' most serious open concern: **"Online safety
disclosure"** (Level 4).

**SAY:**
> "This one's different. A pupil has disclosed that an unknown adult contacted
> them online asking for images. That's a statutory threshold — an immediate
> referral. Watch has already connected the three signals that led here, two of
> them out of hours, and flagged it at Level 4. Now watch what it does *around*
> the DSL's decision."

**DO:** Open the **referral / comms** on the case. Show the **pre-filled MASH
referral** draft and the **referral lifecycle** (submitted → chased → decided).
Show a filed **comms** message and the **case file**.

**SAY:**
> "It drafts the MASH referral, pre-filled from the case. It drafts the letter to
> the parent, the note to the SENCO — filed to the case, ready to send. It tracks
> the referral through the multi-agency process and chases it. When the response
> letter comes back, it reads it and updates the case. **But it prepares and
> pre-fills — the school submits.** Sentinel never sends anything to an external
> body itself."

**SO WHAT:** **The product is the whole safeguarding workflow, not just
detection.** This is the answer to "isn't this just alerting?" — it removes hours
of admin per case, which is how you justify the per-pupil fee and how a DSL falls
in love with it.

---

## Act 5 — It's real (Admin → Wonde connection)

**DO:** Switch to the **Admin** account → `/dashboard/admin/onboarding` → the
**Connect Wonde** step. Then show the **live sandbox school** in the trust.

**SAY:**
> "Everything so far ran on a synthetic school so the story's legible in ten
> minutes. But this isn't a mockup. This school is connected **live through
> Wonde** — the integration layer that already sits on top of the MIS every UK
> school uses. Read-only, DPIA-gated, one click. Its actual roll — over a
> thousand pupils — and its real attendance are flowing through the *exact same
> engine* you just watched. From nothing to a connected, analysed school in
> minutes."

**SO WHAT:** **This kills the "is it vaporware?" question.** The pipeline is real
and connects to what schools already run. Distribution via Wonde is the go-to-
market unlock — thousands of schools, one integration.

> If asked why the live school has fewer flagged patterns than the synthetic one:
> be straight — it's generic MIS test data with no engineered safeguarding story
> in it. The point of the live school is to prove the *pipeline* and the
> *field-level integration*; the synthetic schools carry the *narrative*. Same
> engine over both. (This is genuinely how a real design-partner rollout looks:
> connect first, the patterns emerge from the school's own real data over weeks.)

---

## Act 6 — Why a trust says yes (`/dashboard/audit`, `/dashboard/governance`)

**DO:** Open the **audit log**.

**SAY:**
> "Every read and write against a child's record is here — who, what, when, and
> why. Append-only. Nothing is ever hard-deleted. Even *viewing* this log is
> itself logged. This is what turns 'an AI looked at pupil data' into something a
> school's DPO and an Ofsted inspector will actually sign off."

**DO:** Glance at **governance** / the footer.

**SAY:**
> "All of it — data and inference — stays in the UK, in AWS London. Sentinel
> reads from the school's systems and **never writes back** to them. KCSIE
> aligned, UK GDPR. The whole thing is built so the answer to a procurement
> questionnaire is already yes."

**Close:**
> "So: we surface the child a busy DSL can't, days earlier, across systems and
> across schools; we do the admin around the decision; and we do it in a way a
> safeguarding lead, a DPO and an inspector all trust. The MIS vendors won't build
> this — it's not their job and it crosses their walled gardens. That
> cross-school intelligence layer, sitting safely on top of what schools already
> run, is the company."

---

## Numbers to quote (reconfirm against the live instance first)

- **Weald Learning Trust:** five schools; synthetic roll with embedded patterns +
  one live Wonde-connected school (~1,000+ pupils). Confirm pupil / active-concern
  counts on the trust overview on the day — they depend on the seed settings and
  the live sync, so quote what's on screen, not a memorised figure.
- **Hero cases (Downlands):**
  - *Online safety disclosure* — Level 4, 3 signals / 2 systems, surfaced 5 days out, 2 out-of-hours.
  - *Attendance and behaviour pattern* — 5 signals / 3 domains, surfaced 9 days out.
  - *Welfare and presentation pattern* — Level 3 (Early Help), 3 signals, surfaced 10 days out, attendance 88%.
- **Time to surface** is the headline metric. Say it as a computed, defensible
  claim ("days before the next scheduled review would have connected these"), not
  a marketing number.

---

## Likely investor questions (have these ready)

- **"Is this just alerting / what's the moat?"** → No — it's the whole workflow
  (Act 4) plus the cross-school intelligence layer (Act 1) that only exists above
  the individual school. MIS vendors won't cross their own walled gardens to build
  it; point safeguarding tools (CPOMS, MyConcern) are systems of *record*, not of
  *intelligence*. We sit on top of both via Wonde.
- **"How do you know it's earlier / is time-to-surface real?"** → It's computed
  from when the signals existed in the source data versus the cadence of the
  school's own review cycle — a defensible method, not a slogan. Happy to show the
  rules engine.
- **"Isn't AI on children's data a risk?"** → That's exactly why it's built the
  way it is: deterministic rules first, LLM strictly advisory and labelled, human
  confirms every consequential action, identity sealed until warranted, full
  append-only audit, UK data residency, never writes back to the MIS.
- **"Go-to-market?"** → Wonde is the distribution wedge (one integration, national
  reach); MATs are the buyer (budget + board-level safeguarding duty); land at
  trust level, expand school by school. Design partners: Downlands, Patcham.
- **"Why now?"** → KCSIE 2024 raised the compliance bar; MATs are consolidating
  safeguarding accountability upward; Wonde has made the data reachable. The layer
  is finally buildable and finally needed.

---

## If a screen misbehaves

The dashboard degrades to a graceful in-shell error with a "Try again" — the
sidebar stays, no bare crash. If anything looks off mid-demo, click *Try again*
or move to the next act; the story doesn't depend on any single screen loading.
Re-run the Reset demo workflow between run-throughs.
