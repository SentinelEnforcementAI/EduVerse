import { describe, expect, it } from "vitest";

import { caseLifecycle, domainFromSource, riskFactorsFor } from "./case-insight";

describe("domainFromSource", () => {
  it("keeps the domain before the slash", () => {
    expect(domainFromSource("Attendance / SIMS")).toBe("Attendance");
    expect(domainFromSource("SEND / Bromcom")).toBe("SEND");
    expect(domainFromSource("Pastoral")).toBe("Pastoral");
  });
});

describe("riskFactorsFor", () => {
  it("buckets evidence by domain, takes the highest level, and dedupes", () => {
    const factors = riskFactorsFor({
      primaryLevel: 3,
      primaryDomain: "Pastoral",
      points: [
        { label: "Missed periods", src: "Attendance / SIMS" },
        { label: "Quieter in form", src: "Pastoral / Watch entry" },
        { label: "Quieter in form", src: "Pastoral / Watch entry" }, // dup
        { label: "No source point", src: null }, // falls back to primaryDomain
      ],
      siblings: [
        { level: 2, domain: "Attendance", title: "Attendance drop" },
        { level: 4, domain: "Behaviour", title: "Serious incident" },
      ],
    });

    const byDomain = Object.fromEntries(factors.map((f) => [f.domain, f]));

    // Attendance appears from a point (level 3) and a sibling (level 2) → max 3.
    expect(byDomain.Attendance!.level).toBe(3);
    // Pastoral gets the primary-domain fallback point plus its own; deduped.
    expect(byDomain.Pastoral!.evidence).toEqual([
      "Quieter in form",
      "No source point",
    ]);
    // Behaviour comes only from the level-4 sibling.
    expect(byDomain.Behaviour!.level).toBe(4);
    // Sorted by level descending — Behaviour (4) first.
    expect(factors[0]!.domain).toBe("Behaviour");
  });

  it("caps evidence at three lines per domain", () => {
    const [factor] = riskFactorsFor({
      primaryLevel: 2,
      primaryDomain: "Attendance",
      points: [
        { label: "a", src: "Attendance / SIMS" },
        { label: "b", src: "Attendance / SIMS" },
        { label: "c", src: "Attendance / SIMS" },
        { label: "d", src: "Attendance / SIMS" },
      ],
      siblings: [],
    });
    expect(factor!.evidence).toHaveLength(3);
  });

  it("returns nothing when there is no evidence", () => {
    expect(
      riskFactorsFor({
        primaryLevel: 1,
        primaryDomain: "Attendance",
        points: [],
        siblings: [],
      }),
    ).toEqual([]);
  });
});

describe("caseLifecycle", () => {
  it("marks the first outstanding stage current while a case is open", () => {
    const stages = caseLifecycle({
      status: "OPEN",
      caseFileOpened: false,
      reviewsScheduled: 0,
      referralSubmitted: false,
      referralDecided: false,
    });
    expect(stages.map((s) => s.state)).toEqual([
      "done", // raised
      "current", // opened
      "pending", // reviewed
      "pending", // referred
      "pending", // closed
    ]);
  });

  it("reflects an open case with a file and a scheduled review", () => {
    const stages = caseLifecycle({
      status: "OPEN",
      caseFileOpened: true,
      reviewsScheduled: 1,
      referralSubmitted: false,
      referralDecided: false,
    });
    const state = Object.fromEntries(stages.map((s) => [s.key, s.state]));
    expect(state).toMatchObject({
      raised: "done",
      opened: "done",
      reviewed: "done",
      referred: "current",
    });
  });

  it("has no current stage once the case is closed (dismissed)", () => {
    const stages = caseLifecycle({
      status: "DISMISSED",
      caseFileOpened: false,
      reviewsScheduled: 0,
      referralSubmitted: false,
      referralDecided: false,
    });
    expect(stages.some((s) => s.state === "current")).toBe(false);
    expect(stages.find((s) => s.key === "closed")!.state).toBe("done");
    expect(stages.find((s) => s.key === "reviewed")!.state).toBe("done");
  });

  it("marks referred and closed done for a decided referral", () => {
    const stages = caseLifecycle({
      status: "ESCALATED",
      caseFileOpened: true,
      reviewsScheduled: 1,
      referralSubmitted: true,
      referralDecided: true,
    });
    expect(stages.every((s) => s.state === "done")).toBe(true);
  });
});
