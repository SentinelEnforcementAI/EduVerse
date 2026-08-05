import { escalationLevel, type EscalationLevel } from "@/server/escalation";

// Trust-level safeguarding analytics, computed from real signals and the pupil
// roll — never a score on a child. The DB reads live in the router; this module
// is the pure shaping step, so the aggregation is unit-testable without a
// database. Everything here is a count, a rate, or a trend of real data.

export type InsightPupil = {
  id: string;
  yearGroup: number;
  pupilPremium: boolean;
  freeSchoolMeals: boolean;
  senStatus: string | null;
  eal: boolean;
  lookedAfter: boolean;
  youngCarer: boolean;
  serviceChild: boolean;
};

export type InsightSignal = {
  pupilId: string;
  status: "OPEN" | "CONFIRMED" | "DISMISSED" | "ESCALATED";
  severity: number;
  serious: boolean;
  ruleKey: string;
  windowEnd: Date;
};

export type InsightSchool = {
  name: string;
  pupils: InsightPupil[];
  signals: InsightSignal[];
};

const ACTIVE = new Set(["OPEN", "CONFIRMED", "ESCALATED"]);

type Domain = { key: string; label: string };

export function domainOfRule(ruleKey: string): Domain {
  if (ruleKey.startsWith("attendance") || ruleKey.startsWith("sustained"))
    return { key: "attendance", label: "Attendance" };
  if (ruleKey.startsWith("behaviour")) return { key: "behaviour", label: "Behaviour" };
  if (ruleKey.startsWith("attainment"))
    return { key: "attainment", label: "Attainment" };
  if (ruleKey.startsWith("cross") || ruleKey.startsWith("demo"))
    return { key: "cross-domain", label: "Cross-domain" };
  return { key: "wellbeing", label: "Wellbeing" };
}

// The statutory cohorts a head of safeguarding watches for over-representation.
// Exported as the single source of truth — the concerns filter reuses these.
export type CohortFlags = Pick<
  InsightPupil,
  | "pupilPremium"
  | "freeSchoolMeals"
  | "senStatus"
  | "eal"
  | "lookedAfter"
  | "youngCarer"
  | "serviceChild"
>;

export const COHORT_DEFS: {
  key: string;
  label: string;
  has: (f: CohortFlags) => boolean;
}[] = [
  { key: "pupilPremium", label: "Pupil Premium", has: (p) => p.pupilPremium },
  { key: "freeSchoolMeals", label: "Free school meals", has: (p) => p.freeSchoolMeals },
  { key: "sen", label: "SEN (support or EHCP)", has: (p) => p.senStatus !== null },
  { key: "eal", label: "EAL", has: (p) => p.eal },
  { key: "lookedAfter", label: "Looked-after", has: (p) => p.lookedAfter },
  { key: "youngCarer", label: "Young carer", has: (p) => p.youngCarer },
  { key: "serviceChild", label: "Service child", has: (p) => p.serviceChild },
];

// The cohort keys a pupil belongs to — non-identifying, safe on a sealed row.
export function cohortsFor(flags: CohortFlags): string[] {
  return COHORT_DEFS.filter((c) => c.has(flags)).map((c) => c.key);
}

function monthKeys(now: Date, months: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-GB", { month: "short" }),
    });
  }
  return out;
}

export type TrustInsights = ReturnType<typeof buildInsights>;

export function buildInsights(schools: InsightSchool[], now: Date) {
  const TREND_MONTHS = 12;
  const months = monthKeys(now, TREND_MONTHS);
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  let pupilsOnRoll = 0;
  let activeConcerns = 0;
  let awaiting = 0;
  let escalated = 0;
  const outcomes = { open: 0, confirmed: 0, escalated: 0, dismissed: 0 };
  const levelCount: Record<EscalationLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const domainCount = new Map<string, { label: string; count: number }>();
  const volume = new Array<number>(TREND_MONTHS).fill(0);
  const bySchool: { name: string; pupilsOnRoll: number; activeConcerns: number; per100: number }[] = [];

  // Roll-wide and concern-pupil cohort tallies (distinct pupils).
  const rollCohort = new Map<string, number>();
  const concernCohort = new Map<string, number>();
  let concernPupilTotal = 0;

  for (const school of schools) {
    pupilsOnRoll += school.pupils.length;
    const pupilById = new Map(school.pupils.map((p) => [p.id, p]));

    for (const c of COHORT_DEFS) {
      rollCohort.set(c.key, (rollCohort.get(c.key) ?? 0) + school.pupils.filter(c.has).length);
    }

    let schoolActive = 0;
    const concernPupils = new Set<string>();
    for (const s of school.signals) {
      // Outcomes span every signal, active or closed.
      if (s.status === "OPEN") outcomes.open++;
      else if (s.status === "CONFIRMED") outcomes.confirmed++;
      else if (s.status === "ESCALATED") outcomes.escalated++;
      else outcomes.dismissed++;

      if (!ACTIVE.has(s.status)) continue;
      activeConcerns++;
      schoolActive++;
      if (s.status === "OPEN") awaiting++;
      if (s.status === "ESCALATED") escalated++;

      const level = escalationLevel(s.severity, s.serious);
      levelCount[level]++;

      const domain = domainOfRule(s.ruleKey);
      const d = domainCount.get(domain.key) ?? { label: domain.label, count: 0 };
      d.count++;
      domainCount.set(domain.key, d);

      const mi = monthIndex.get(`${s.windowEnd.getFullYear()}-${s.windowEnd.getMonth()}`);
      if (mi !== undefined) volume[mi]!++;

      concernPupils.add(s.pupilId);
    }

    // Cohort membership of the pupils who have an active concern.
    for (const pid of concernPupils) {
      const p = pupilById.get(pid);
      if (!p) continue;
      concernPupilTotal++;
      for (const c of COHORT_DEFS) {
        if (c.has(p)) concernCohort.set(c.key, (concernCohort.get(c.key) ?? 0) + 1);
      }
    }

    bySchool.push({
      name: school.name,
      pupilsOnRoll: school.pupils.length,
      activeConcerns: schoolActive,
      per100: school.pupils.length
        ? Math.round((schoolActive / school.pupils.length) * 1000) / 10
        : 0,
    });
  }

  const cohortLens = COHORT_DEFS.map((c) => {
    const rollCount = rollCohort.get(c.key) ?? 0;
    const concernCount = concernCohort.get(c.key) ?? 0;
    return {
      key: c.key,
      label: c.label,
      rollCount,
      concernCount,
      rollShare: pupilsOnRoll ? rollCount / pupilsOnRoll : 0,
      concernShare: concernPupilTotal ? concernCount / concernPupilTotal : 0,
    };
  })
    // Most over-represented among flagged pupils first — the head of
    // safeguarding's first question is which cohorts are carrying concern.
    .sort((a, b) => b.concernShare - b.rollShare - (a.concernShare - a.rollShare));

  return {
    totals: {
      schools: schools.length,
      pupilsOnRoll,
      activeConcerns,
      awaitingDecision: awaiting,
      escalated,
    },
    volumeByMonth: { labels: months.map((m) => m.label), values: volume },
    levelMix: ([1, 2, 3, 4] as EscalationLevel[]).map((level) => ({
      level,
      count: levelCount[level],
    })),
    domainMix: [...domainCount.entries()]
      .map(([key, v]) => ({ key, label: v.label, count: v.count }))
      .sort((a, b) => b.count - a.count),
    outcomes,
    cohortLens,
    bySchool: bySchool.sort((a, b) => b.per100 - a.per100),
  };
}
