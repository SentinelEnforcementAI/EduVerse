import { describe, expect, it } from "vitest";

import {
  buildSchoolTermlyReport,
  buildTrustTermlyReport,
} from "@/server/reports/termly";

const generatedOn = new Date(Date.UTC(2026, 3, 28));

describe("buildTrustTermlyReport", () => {
  const report = buildTrustTermlyReport({
    trustName: "Weald Learning Trust",
    generatedOn,
    pupilsOnRoll: 1600,
    activeConcerns: 12,
    awaitingDecision: 4,
    schools: [
      {
        name: "Downlands",
        pupilsOnRoll: 800,
        activeConcerns: 7,
        awaitingDecision: 3,
      },
      {
        name: "Patcham",
        pupilsOnRoll: 800,
        activeConcerns: 5,
        awaitingDecision: 1,
      },
    ],
  });

  it("includes the computed figures and every school", () => {
    expect(report).toContain("Weald Learning Trust");
    expect(report).toContain("Pupils on roll across the trust: 1600");
    expect(report).toContain("Active concerns across the trust: 12");
    expect(report).toContain("Downlands");
    expect(report).toContain("Patcham");
    expect(report).toContain("28 April 2026");
  });

  it("contains no em or en dashes (spec principle 6)", () => {
    expect(report).not.toContain("—");
    expect(report).not.toContain("–");
  });
});

describe("buildSchoolTermlyReport", () => {
  const report = buildSchoolTermlyReport({
    schoolName: "Downlands",
    generatedOn,
    pupilsOnRoll: 800,
    activeConcerns: 7,
    awaitingDecision: 3,
    reviewed: 5,
  });

  it("includes the school's computed figures", () => {
    expect(report).toContain("Downlands");
    expect(report).toContain("Pupils on roll: 800");
    expect(report).toContain("Concerns reviewed and recorded this term: 5");
  });

  it("contains no em or en dashes", () => {
    expect(report).not.toContain("—");
    expect(report).not.toContain("–");
  });
});
