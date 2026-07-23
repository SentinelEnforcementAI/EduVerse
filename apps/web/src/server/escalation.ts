// Escalation levels (spec section 7 / principle 4).
//
// Levels 1 to 4 describe the proportionate RESPONSE, not the child. There is
// never a numeric risk score on a pupil: the internal engine severity (how
// strongly a rule fired) is mapped here to a level, and only the level is ever
// shown. Identity follows the level: sealed at 1 and 2, revealable at 3 and 4
// (the gated reveal itself lands with the human-in-the-loop slice).
//
// CTO-DECISION: the spec requires levels to be configurable per trust against
// their local safeguarding partnership thresholds, and NOT hardcoded in the
// engine. This mapping is the simplest working version — a fixed severity to
// level table applied at presentation, kept out of the rules engine — until the
// per-trust threshold configuration exists.

export type EscalationLevel = 1 | 2 | 3 | 4;

export function escalationLevel(
  severity: number,
  serious = false,
): EscalationLevel {
  if (serious) return 4;
  if (severity >= 3) return 3;
  if (severity === 2) return 2;
  return 1;
}

// Whether identity may be revealed at this level (spec section 7). Sealing is
// still the default at every level; this only says a reveal is permitted.
export function isRevealable(level: EscalationLevel, serious = false): boolean {
  return serious || level >= 3;
}

export type LevelMeta = {
  level: EscalationLevel;
  label: string;
  meaning: string;
  route: string[];
  rationale: string;
};

export const LEVEL_META: Record<EscalationLevel, LevelMeta> = {
  1: {
    level: 1,
    label: "Level 1 — Monitor",
    meaning: "Monitor",
    route: ["Watch continues, no action"],
    rationale:
      "Signals sit within the pupil's own normal range. Watch keeps monitoring and will raise the level if the pattern strengthens.",
  },
  2: {
    level: 2,
    label: "Level 2 — Emerging need",
    meaning: "Emerging need",
    route: [
      "Pastoral review",
      "Parental or carer contact",
      "SENCO or Early Help as needed",
    ],
    rationale:
      "Signals point to an emerging need, not immediate risk of harm. The proportionate response is school-led support. Watch will re-assess the level if new signals are logged.",
  },
  3: {
    level: 3,
    label: "Level 3 — Targeted support",
    meaning: "Targeted support",
    route: [
      "Early Help lead",
      "Targeted, coordinated support",
      "Possible external agency",
    ],
    rationale:
      "A coordinated, targeted Early Help response is proportionate. Watch will escalate to a statutory referral if a safeguarding disclosure follows.",
  },
  4: {
    level: 4,
    label: "Level 4 — Statutory threshold",
    meaning: "Statutory threshold",
    route: [
      "MASH referral, same day",
      "DSL leads",
      "Preserve evidence",
    ],
    rationale:
      "Meets the threshold for a same-day referral to children's social care. Watch prepares and pre-fills; the school submits.",
  },
};

// A qualitative confidence band derived from the engine's severity (how
// strongly the rule fired against its threshold). Qualitative on purpose:
// there is no calibrated confidence model yet, so no false precision.
// CTO-DECISION: a calibrated confidence figure replaces this once the engine
// records margin-over-threshold consistently across rules.
export function confidenceBand(severity: number): string {
  if (severity >= 3) return "Higher";
  if (severity === 2) return "Moderate";
  return "Emerging";
}

// The source system a signal's evidence comes from, for timeline attribution
// (spec 5.5 "What Watch sees"). Derived from the rule that fired. In the demo
// this is written by hand (Attendance / SIMS etc.); here it is the real domain
// of the rule, with the production MIS shown once ingestion is wired per trust.
export function sourceForRule(ruleKey: string): string {
  if (ruleKey.startsWith("attendance") || ruleKey.startsWith("sustained"))
    return "Attendance";
  if (ruleKey.startsWith("behaviour")) return "Behaviour";
  if (ruleKey.startsWith("attainment")) return "Attainment";
  if (ruleKey.startsWith("cross")) return "Cross-domain";
  return "Watch";
}
