import { describe, expect, it } from "vitest";

import {
  confidenceBand,
  escalationLevel,
  isRevealable,
  LEVEL_META,
  sourceForRule,
} from "@/server/escalation";

describe("escalationLevel", () => {
  it("maps engine severity to a proportionate level, serious overriding", () => {
    expect(escalationLevel(1)).toBe(1);
    expect(escalationLevel(2)).toBe(2);
    expect(escalationLevel(3)).toBe(3);
    expect(escalationLevel(1, true)).toBe(4);
  });
});

describe("isRevealable", () => {
  it("seals levels 1 and 2, permits reveal at 3, 4, or serious", () => {
    expect(isRevealable(1)).toBe(false);
    expect(isRevealable(2)).toBe(false);
    expect(isRevealable(3)).toBe(true);
    expect(isRevealable(4)).toBe(true);
    expect(isRevealable(1, true)).toBe(true);
  });
});

describe("LEVEL_META", () => {
  it("carries a route and rationale for every level", () => {
    for (const level of [1, 2, 3, 4] as const) {
      expect(LEVEL_META[level].route.length).toBeGreaterThan(0);
      expect(LEVEL_META[level].rationale.length).toBeGreaterThan(0);
      expect(LEVEL_META[level].label).toContain(String(level));
    }
  });
});

describe("confidenceBand", () => {
  it("is a qualitative band, never a numeric score", () => {
    expect(confidenceBand(3)).toBe("Higher");
    expect(confidenceBand(2)).toBe("Moderate");
    expect(confidenceBand(1)).toBe("Emerging");
  });
});

describe("sourceForRule", () => {
  it("attributes a signal to the source domain of the rule that fired", () => {
    expect(sourceForRule("attendance-drop")).toBe("Attendance");
    expect(sourceForRule("sustained-absence")).toBe("Attendance");
    expect(sourceForRule("behaviour-spike")).toBe("Behaviour");
    expect(sourceForRule("attainment-decline")).toBe("Attainment");
    expect(sourceForRule("cross-domain")).toBe("Cross-domain");
  });
});
