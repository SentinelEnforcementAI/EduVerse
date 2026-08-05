import type { EscalationLevel } from "@/server/escalation";

// Derived case insight: the domain "risk factors" breakdown and the lifecycle
// stepper. Both are computed from real case state — signals, their evidence,
// the case file, referral — never from a stored score. There is deliberately
// NO single numeric risk number on a child (CLAUDE.md principle 4): a factor
// carries the escalation LEVEL of the signals behind it and the evidence that
// justifies it, and only domains with real evidence appear (we never invent a
// "Family: Low — no concerns" row).

// The domain a signal or data point belongs to. Data-point sources look like
// "Attendance / SIMS" or "SEND / Bromcom"; we keep the domain (the part before
// the slash), which is the MIS-neutral label a DSL reads.
export function domainFromSource(src: string): string {
  return src.split("/")[0]!.trim();
}

export type RiskFactor = {
  domain: string;
  level: EscalationLevel;
  evidence: string[];
};

// Decompose a pupil's live concern picture into per-domain factors: this case's
// evidence bucketed by domain, merged with the pupil's other open signals. Each
// domain takes the highest escalation level contributing to it and up to three
// lines of the evidence behind it.
export function riskFactorsFor(input: {
  primaryLevel: EscalationLevel;
  // Fallback domain for evidence points that carry no explicit source.
  primaryDomain: string;
  points: { label: string; src?: string | null }[];
  siblings: { level: EscalationLevel; domain: string; title: string }[];
}): RiskFactor[] {
  const byDomain = new Map<string, { level: EscalationLevel; evidence: string[] }>();
  const add = (domain: string, level: EscalationLevel, evidence: string) => {
    const cur = byDomain.get(domain);
    if (!cur) {
      byDomain.set(domain, { level, evidence: [evidence] });
      return;
    }
    if (level > cur.level) cur.level = level;
    if (cur.evidence.length < 3 && !cur.evidence.includes(evidence)) {
      cur.evidence.push(evidence);
    }
  };

  for (const p of input.points) {
    add(p.src ? domainFromSource(p.src) : input.primaryDomain, input.primaryLevel, p.label);
  }
  for (const s of input.siblings) {
    add(s.domain, s.level, s.title);
  }

  return [...byDomain.entries()]
    .map(([domain, v]) => ({ domain, level: v.level, evidence: v.evidence }))
    .sort((a, b) => b.level - a.level || a.domain.localeCompare(b.domain));
}

export type LifecycleState = "done" | "current" | "pending";
export type LifecycleStage = { key: string; label: string; state: LifecycleState };

const STAGES: { key: string; label: string }[] = [
  { key: "raised", label: "Concern raised" },
  { key: "opened", label: "Case file opened" },
  { key: "reviewed", label: "Reviewed" },
  { key: "referred", label: "Referred" },
  { key: "closed", label: "Closed" },
];

// Compose the case's real state into an ordered lifecycle. A case can branch
// (e.g. dismissed at review without a referral), so each stage reflects its own
// truth rather than assuming a single linear path; "current" marks the first
// outstanding stage while the case is still open.
export function caseLifecycle(input: {
  status: "OPEN" | "CONFIRMED" | "DISMISSED" | "ESCALATED";
  caseFileOpened: boolean;
  reviewsScheduled: number;
  referralSubmitted: boolean;
  referralDecided: boolean;
}): LifecycleStage[] {
  const decisionMade = input.status !== "OPEN";
  const closed = input.status === "DISMISSED" || input.referralDecided;
  const done: Record<string, boolean> = {
    raised: true,
    opened: input.caseFileOpened,
    reviewed: decisionMade || input.reviewsScheduled > 0,
    referred: input.referralSubmitted,
    closed,
  };

  const firstOutstanding = STAGES.find((s) => !done[s.key])?.key;
  return STAGES.map((s) => ({
    key: s.key,
    label: s.label,
    state: done[s.key]
      ? "done"
      : !closed && s.key === firstOutstanding
        ? "current"
        : "pending",
  }));
}
