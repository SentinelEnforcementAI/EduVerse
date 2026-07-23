import { describe, expect, it } from "vitest";

import {
  buildDraft,
  COMM_TYPES,
  type CaseDraftData,
} from "@/server/comms/templates";

const data: CaseDraftData = {
  schoolName: "Downlands",
  pupilRef: "Pupil 0471",
  yearGroup: 9,
  window: "14 April 2026 to 28 April 2026",
  dsl: "Priya Sharma",
  date: "28 April 2026",
  confidence: "Higher",
  timeline: [
    { date: "2026-04-14", label: "AM absence (code O)", source: "Attendance" },
    { date: "2026-04-22", label: "Left class without permission", source: "Behaviour" },
  ],
  overall: "The signals move in the same direction over a fortnight.",
};

describe("buildDraft", () => {
  it("produces a complete draft for every comm type", () => {
    for (const type of COMM_TYPES) {
      const draft = buildDraft(type, data);
      expect(draft.length).toBeGreaterThan(100);
    }
  });

  it("never contains an em or en dash (spec principle 6)", () => {
    for (const type of COMM_TYPES) {
      const draft = buildDraft(type, data);
      expect(draft).not.toContain("—");
      expect(draft).not.toContain("–");
    }
  });

  it("cites the pupil reference on record-style documents", () => {
    // Internal records and referrals identify the case by reference; warm
    // letters to a parent address "your child" and cite no reference.
    for (const type of [
      "mash",
      "senco",
      "earlyhelp",
      "wellbeing",
      "antibully",
      "chronology",
    ] as const) {
      expect(buildDraft(type, data)).toContain("Pupil 0471");
    }
  });

  it("addresses parent letters to the carer without citing a reference", () => {
    for (const type of ["parent", "attendance"] as const) {
      const draft = buildDraft(type, data);
      expect(draft).toContain("your child");
      expect(draft).not.toContain("Pupil 0471");
    }
  });

  it("signs comms as the acting DSL and names the school", () => {
    const letter = buildDraft("parent", data);
    expect(letter).toContain("Priya Sharma");
    expect(letter).toContain("Downlands");
  });
});
