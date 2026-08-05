import { describe, expect, it } from "vitest";

import {
  buildInsights,
  domainOfRule,
  type InsightPupil,
  type InsightSchool,
  type InsightSignal,
} from "./insights";

function pupil(id: string, yearGroup: number, flags: Partial<InsightPupil> = {}): InsightPupil {
  return {
    id,
    yearGroup,
    pupilPremium: false,
    freeSchoolMeals: false,
    senStatus: null,
    eal: false,
    lookedAfter: false,
    youngCarer: false,
    serviceChild: false,
    ...flags,
  };
}

const NOW = new Date(2026, 7, 15); // 15 Aug 2026

function sig(
  pupilId: string,
  status: InsightSignal["status"],
  severity: number,
  serious: boolean,
  ruleKey: string,
): InsightSignal {
  return { pupilId, status, severity, serious, ruleKey, windowEnd: NOW };
}

describe("domainOfRule", () => {
  it("maps rule keys to safeguarding domains", () => {
    expect(domainOfRule("attendance-drop").key).toBe("attendance");
    expect(domainOfRule("sustained-absence").key).toBe("attendance");
    expect(domainOfRule("behaviour-spike").key).toBe("behaviour");
    expect(domainOfRule("attainment-decline").key).toBe("attainment");
    expect(domainOfRule("demo-hero").key).toBe("cross-domain");
  });
});

describe("buildInsights", () => {
  const schools: InsightSchool[] = [
    {
      name: "Downlands",
      pupils: [
        pupil("p1", 9, { pupilPremium: true, senStatus: "EHCP" }),
        pupil("p2", 9, { pupilPremium: true, freeSchoolMeals: true }),
        pupil("p3", 8, { youngCarer: true }),
        pupil("p4", 7),
      ],
      signals: [
        sig("p1", "OPEN", 3, false, "attendance-drop"), // active, level 3
        sig("p2", "ESCALATED", 2, true, "behaviour-spike"), // active, serious → level 4
        sig("p3", "DISMISSED", 1, false, "cross-domain"), // closed
        sig("p1", "CONFIRMED", 2, false, "attendance-drop"), // active, level 2
      ],
    },
    {
      name: "Patcham",
      pupils: [pupil("p5", 9, { pupilPremium: true }), pupil("p6", 7)],
      signals: [sig("p5", "OPEN", 4, false, "demo-hero")], // active, level 3, cross-domain
    },
  ];

  const out = buildInsights(schools, NOW);

  it("totals the roll and the active caseload", () => {
    expect(out.totals).toMatchObject({
      schools: 2,
      pupilsOnRoll: 6,
      activeConcerns: 4,
      awaitingDecision: 2, // two OPEN
      escalated: 1,
    });
  });

  it("counts every signal in the outcomes, active or closed", () => {
    expect(out.outcomes).toEqual({ open: 2, confirmed: 1, escalated: 1, dismissed: 1 });
  });

  it("bins active concerns by escalation level", () => {
    const byLevel = Object.fromEntries(out.levelMix.map((m) => [m.level, m.count]));
    expect(byLevel).toEqual({ 1: 0, 2: 1, 3: 2, 4: 1 });
  });

  it("ranks the domains driving concern", () => {
    expect(out.domainMix.map((d) => [d.key, d.count])).toEqual([
      ["attendance", 2],
      ["behaviour", 1],
      ["cross-domain", 1],
    ]);
  });

  it("computes the cohort lens as concern share vs roll share", () => {
    const pp = out.cohortLens.find((c) => c.key === "pupilPremium")!;
    // All three concern pupils (p1, p2, p5) are Pupil Premium; half the roll is.
    expect(pp.concernCount).toBe(3);
    expect(pp.concernShare).toBeCloseTo(1);
    expect(pp.rollShare).toBeCloseTo(3 / 6);

    // A young carer exists on the roll but is not among the concern pupils.
    const yc = out.cohortLens.find((c) => c.key === "youngCarer")!;
    expect(yc.concernCount).toBe(0);
    expect(yc.rollShare).toBeCloseTo(1 / 6);
  });

  it("compares schools by active concerns per 100 pupils", () => {
    const bySchool = Object.fromEntries(out.bySchool.map((s) => [s.name, s.per100]));
    expect(bySchool.Downlands).toBeCloseTo(75); // 3 of 4
    expect(bySchool.Patcham).toBeCloseTo(50); // 1 of 2
  });

  it("buckets volume into the month a concern surfaced", () => {
    const v = out.volumeByMonth.values;
    expect(v[v.length - 1]).toBe(4); // all four active concerns surfaced this month
    expect(v.reduce((a, b) => a + b, 0)).toBe(4);
  });
});
