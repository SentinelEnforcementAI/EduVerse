import { describe, expect, it } from "vitest";

import {
  generatePupil,
  generateSchool,
  patternForIndex,
  schoolDays,
  type GeneratedPupil,
  type SchoolConfig,
} from "../src/synthetic/generator";

// Pure tests — no database. These pin down the properties the rules engine
// (build step 5) will rely on: determinism and the embedded risk patterns.

const config: SchoolConfig = {
  schoolSlug: "downlands",
  seed: 1001,
  pupilCount: 100,
  months: 12,
  anchorDate: new Date(Date.UTC(2026, 6, 21)),
};

function pupilWithPattern(pattern: string): GeneratedPupil {
  for (let i = 0; i < config.pupilCount; i++) {
    if (patternForIndex(i, config.pupilCount) === pattern) {
      return generatePupil(config, i);
    }
  }
  throw new Error(`no pupil with pattern ${pattern}`);
}

function absenceRate(records: GeneratedPupil["attendance"]): number {
  const absent = records.filter((r) => !r.present).length;
  return absent / records.length;
}

describe("schoolDays", () => {
  it("contains only weekdays within the window", () => {
    const days = schoolDays(config.anchorDate, 12);
    expect(days.length).toBeGreaterThan(240);
    expect(days.every((d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5)).toBe(true);
    expect(days[days.length - 1]!.getTime()).toBeLessThanOrEqual(
      config.anchorDate.getTime(),
    );
  });
});

describe("determinism", () => {
  it("same seed and index produce identical pupils", () => {
    expect(generatePupil(config, 42)).toEqual(generatePupil(config, 42));
  });

  it("different indexes produce different data", () => {
    expect(generatePupil(config, 1).upn).not.toEqual(generatePupil(config, 2).upn);
  });
});

describe("safeguarding context", () => {
  it("carries deterministic statutory-context and snapshot fields", () => {
    const p = generatePupil(config, 7);
    // Booleans present; a language and ethnicity always set; admission is a Date.
    for (const flag of [
      p.pupilPremium,
      p.freeSchoolMeals,
      p.eal,
      p.lookedAfter,
      p.youngCarer,
      p.serviceChild,
    ]) {
      expect(typeof flag).toBe("boolean");
    }
    expect(p.firstLanguage).toBeTruthy();
    expect(p.ethnicity).toBeTruthy();
    expect(p.admissionDate).toBeInstanceOf(Date);
    // A non-EAL pupil's first language is English; an EAL pupil's is not.
    expect(p.eal ? p.firstLanguage !== "English" : p.firstLanguage === "English").toBe(true);
    // Deterministic across calls.
    expect(generatePupil(config, 7).senStatus).toEqual(p.senStatus);
  });

  it("produces plausible cohort rates across a roll", () => {
    const pupils = generateSchool({ ...config, pupilCount: 400, months: 3 });
    const pp = pupils.filter((p) => p.pupilPremium).length;
    // Pupil Premium is common but nowhere near everyone.
    expect(pp).toBeGreaterThan(400 * 0.15);
    expect(pp).toBeLessThan(400 * 0.6);
    // FSM pupils are always Pupil Premium.
    expect(pupils.every((p) => !p.freeSchoolMeals || p.pupilPremium)).toBe(true);
  });
});

describe("volumes", () => {
  it("generates the full roll with two sessions per school day", () => {
    const small: SchoolConfig = { ...config, pupilCount: 20, months: 3 };
    const pupils = generateSchool(small);
    const days = schoolDays(small.anchorDate, small.months);
    expect(pupils).toHaveLength(20);
    for (const pupil of pupils) {
      expect(pupil.attendance).toHaveLength(days.length * 2);
      expect(pupil.attainment.length).toBeGreaterThan(0);
    }
  });
});

describe("embedded risk patterns", () => {
  it("attendance-drop: recent absence far above earlier baseline", () => {
    const pupil = pupilWithPattern("attendance-drop");
    const recent = pupil.attendance.slice(-80); // last 40 days × 2 sessions
    const earlier = pupil.attendance.slice(0, -80);
    expect(absenceRate(recent)).toBeGreaterThan(0.25);
    expect(absenceRate(earlier)).toBeLessThan(0.15);
  });

  it("sustained-absence: one weekday habitually missed", () => {
    const pupil = pupilWithPattern("sustained-absence");
    const byWeekday = new Map<number, { absent: number; total: number }>();
    for (const record of pupil.attendance) {
      const dow = record.date.getUTCDay();
      const entry = byWeekday.get(dow) ?? { absent: 0, total: 0 };
      entry.total += 1;
      if (!record.present) entry.absent += 1;
      byWeekday.set(dow, entry);
    }
    const rates = [...byWeekday.values()].map((e) => e.absent / e.total);
    expect(Math.max(...rates)).toBeGreaterThan(0.5);
    expect(rates.filter((r) => r < 0.2)).toHaveLength(4);
  });

  it("behaviour-spike: incident cluster in the recent window", () => {
    const pupil = pupilWithPattern("behaviour-spike");
    const days = schoolDays(config.anchorDate, config.months);
    const windowStart = days[days.length - 30]!.getTime();
    const recent = pupil.behaviour.filter(
      (b) => b.date.getTime() >= windowStart,
    );
    expect(recent.length).toBeGreaterThanOrEqual(6);
  });

  it("attainment-decline: scores fall across the year", () => {
    const pupil = pupilWithPattern("attainment-decline");
    const bySubject = new Map<string, number[]>();
    for (const record of pupil.attainment) {
      const scores = bySubject.get(record.subject) ?? [];
      scores.push(record.score);
      bySubject.set(record.subject, scores);
    }
    const drops = [...bySubject.values()].map(
      (scores) => scores[0]! - scores[scores.length - 1]!,
    );
    const averageDrop = drops.reduce((a, b) => a + b, 0) / drops.length;
    expect(averageDrop).toBeGreaterThan(8);
  });

  it("cross-domain: moderate signals across all three domains", () => {
    // Cross-domain is a deliberately moderate pattern in all three domains, so
    // any single pupil sits near the thresholds and one RNG draw can dip under.
    // Assert the cohort mean over a full-size school, which tests the pattern
    // itself and is robust to how many pupils carry it and their RNG draws.
    const big: SchoolConfig = { ...config, pupilCount: 800 };
    const cohort = generateSchool(big).filter(
      (p) => p.riskPattern === "cross-domain",
    );
    expect(cohort.length).toBeGreaterThanOrEqual(5);
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

    const days = schoolDays(big.anchorDate, big.months);
    const windowStart = days[days.length - 30]!.getTime();

    const absences = cohort.map((p) => absenceRate(p.attendance.slice(-80)));
    expect(mean(absences)).toBeGreaterThan(0.1);

    const incidents = cohort.map(
      (p) => p.behaviour.filter((b) => b.date.getTime() >= windowStart).length,
    );
    expect(mean(incidents)).toBeGreaterThanOrEqual(3);

    const avgDrops = cohort.map((p) => {
      const bySubject = new Map<string, number[]>();
      for (const record of p.attainment) {
        const scores = bySubject.get(record.subject) ?? [];
        scores.push(record.score);
        bySubject.set(record.subject, scores);
      }
      const drops = [...bySubject.values()].map(
        (scores) => scores[0]! - scores[scores.length - 1]!,
      );
      return drops.reduce((a, b) => a + b, 0) / drops.length;
    });
    expect(mean(avgDrops)).toBeGreaterThan(5);
  });

  it("baseline pupils attend normally", () => {
    const pupil = generatePupil(config, config.pupilCount - 1);
    expect(pupil.riskPattern).toBeNull();
    expect(absenceRate(pupil.attendance)).toBeLessThan(0.12);
  });
});
