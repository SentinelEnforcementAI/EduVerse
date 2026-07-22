import { describe, expect, it } from "vitest";

import { SIGNAL_NARRATIVE_PROMPT } from "./prompts";
import {
  assertPseudonymised,
  buildPseudonymisedContext,
  PseudonymisationError,
} from "./pseudonymise";

// Pseudonymisation is provably applied: the allowlist builder excludes
// identifying and free-text fields, and the scrubber fails closed.

const signal = {
  severity: 3,
  windowStart: new Date(Date.UTC(2026, 5, 23)),
  windowEnd: new Date(Date.UTC(2026, 6, 21)),
  reasoning: {
    summary:
      "Attendance over the last 28 days is 58%, against a baseline of 96%.",
    metrics: {
      recentRatePct: 58,
      baselineRatePct: 96,
      dropPercentagePoints: 38,
      nested: { should: "be dropped" },
    },
    dataPoints: [
      {
        // Free text originating from MIS records can contain names — the
        // builder must never include dataPoints.
        label: "Ada Lovelace was seen leaving school at lunch (code O)",
        date: "2026-07-20",
        value: "O",
      },
    ],
  },
  pupil: { yearGroup: 9 },
  ruleVersion: { name: "Attendance drop" },
};

describe("buildPseudonymisedContext", () => {
  it("includes only allowlisted structured fields", () => {
    const context = buildPseudonymisedContext(signal);
    expect(context).toEqual({
      yearGroup: 9,
      ruleName: "Attendance drop",
      severity: 3,
      windowStart: "2026-06-23",
      windowEnd: "2026-07-21",
      ruleSummary:
        "Attendance over the last 28 days is 58%, against a baseline of 96%.",
      metrics: {
        recentRatePct: 58,
        baselineRatePct: 96,
        dropPercentagePoints: 38,
      },
    });
  });

  it("the built prompt carries no identifiers and no free-text data points", () => {
    const prompt = SIGNAL_NARRATIVE_PROMPT.build(
      buildPseudonymisedContext(signal),
    );
    expect(prompt).not.toMatch(/Ada/i);
    expect(prompt).not.toMatch(/Lovelace/i);
    expect(prompt).not.toMatch(/leaving school at lunch/i);
    expect(prompt).toContain("year 9");
    expect(prompt).toContain("dropPercentagePoints: 38");
  });
});

describe("assertPseudonymised", () => {
  it("throws when an identifier appears anywhere in the payload", () => {
    expect(() =>
      assertPseudonymised("metric note: ada was absent on Mondays", [
        "Ada",
        "Lovelace",
        "SW-DOW-0001",
      ]),
    ).toThrow(PseudonymisationError);
  });

  it("matches case-insensitively and on UPNs", () => {
    expect(() =>
      assertPseudonymised("pupil SW-DOW-0001 shows a pattern", ["SW-DOW-0001"]),
    ).toThrow(PseudonymisationError);
  });

  it("does not false-positive on substrings inside other words", () => {
    expect(() =>
      assertPseudonymised("a disgraceful attendance pattern", ["Grace"]),
    ).not.toThrow();
  });

  it("passes a clean payload", () => {
    expect(() =>
      assertPseudonymised("attendance dropped 38 percentage points", [
        "Ada",
        "Lovelace",
      ]),
    ).not.toThrow();
  });
});
