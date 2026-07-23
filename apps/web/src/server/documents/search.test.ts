import { describe, expect, it } from "vitest";

import { rankDocuments, synthesise, type SearchableDoc } from "./search";

const docs: SearchableDoc[] = [
  {
    id: "d1",
    title: "Policy A",
    type: "Policy",
    status: "Current",
    docDate: new Date("2025-09-01"),
    scope: "ORG",
    themes: ["online safety", "filtering"],
    summary: "How the school responds to online incidents.",
    content:
      "Where a child discloses contact from an unknown adult online, staff preserve evidence and escalate to the DSL.",
  },
  {
    id: "d2",
    title: "Online safety and filtering",
    type: "Policy",
    status: "Current",
    docDate: new Date("2025-09-02"),
    scope: "ORG",
    themes: ["attendance"],
    summary: "Attendance strategy.",
    content: "Attendance is treated as a safeguarding issue.",
  },
  {
    id: "d3",
    title: "Behaviour",
    type: "Policy",
    status: "Current",
    docDate: new Date("2025-09-03"),
    scope: "ORG",
    themes: ["behaviour"],
    summary: "Behaviour expectations.",
    content: "The school promotes positive behaviour.",
  },
];

describe("rankDocuments", () => {
  it("matches on content and themes, not just the filename or title", () => {
    // "online" appears in d1's themes and content, and in d2's TITLE only.
    const hits = rankDocuments(docs, "online");
    // d1 (theme + content) must outrank d2 (title only).
    expect(hits[0]!.id).toBe("d1");
    expect(hits.map((h) => h.id)).toContain("d2");
    // d3 (no match anywhere) is absent.
    expect(hits.map((h) => h.id)).not.toContain("d3");
  });

  it("finds a document by its content when the title says nothing", () => {
    // "evidence" only appears in d1's body.
    const hits = rankDocuments(docs, "evidence");
    expect(hits).toHaveLength(1);
    expect(hits[0]!.id).toBe("d1");
    expect(hits[0]!.snippet.toLowerCase()).toContain("evidence");
  });

  it("returns the matched themes so the match is explained", () => {
    const hits = rankDocuments(docs, "filtering");
    expect(hits[0]!.matchedThemes).toContain("filtering");
  });

  it("returns nothing for a query that matches no document", () => {
    expect(rankDocuments(docs, "geography")).toHaveLength(0);
  });
});

describe("synthesise", () => {
  it("summarises the result set with its themes", () => {
    const hits = rankDocuments(docs, "online");
    const summary = synthesise("online", hits);
    expect(summary).toContain("Found");
    expect(summary).toContain("online");
  });

  it("says so when nothing matches", () => {
    expect(synthesise("geography", [])).toContain("No documents");
  });
});
