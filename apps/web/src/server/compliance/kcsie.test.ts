import { describe, expect, it } from "vitest";

import { deriveComponents, type ComplianceDoc } from "./kcsie";

const now = new Date("2026-07-23");

function doc(partial: Partial<ComplianceDoc>): ComplianceDoc {
  return {
    type: "Policy",
    title: "",
    themes: [],
    docDate: new Date("2025-09-06"),
    status: "Current",
    content: "",
    summary: "",
    ...partial,
  };
}

describe("deriveComponents", () => {
  it("derives seven components", () => {
    const { components } = deriveComponents([], now);
    expect(components).toHaveLength(7);
  });

  it("marks the policy up to date when reviewed within the year", () => {
    const { components } = deriveComponents(
      [doc({ type: "Policy", title: "Child Protection Policy", themes: ["child protection"] })],
      now,
    );
    const policy = components.find((c) => c.key === "policy")!;
    expect(policy.status).toBe("ok");
  });

  it("flags a gap when the single central record is missing", () => {
    const { components } = deriveComponents([], now);
    const scr = components.find((c) => c.key === "scr")!;
    expect(scr.status).toBe("gap");
  });

  it("marks DSL training up to date from a certificate with a future renewal", () => {
    const { components } = deriveComponents(
      [
        doc({
          type: "Training",
          title: "DSL Training Certificate",
          themes: ["dsl"],
          summary: "Renews March 2027",
          content: "Renews March 2027",
        }),
      ],
      now,
    );
    const dsl = components.find((c) => c.key === "dsl-training")!;
    expect(dsl.status).toBe("ok");
  });

  it("rolls the overall status up to the worst component", () => {
    const { overall } = deriveComponents([], now);
    // With no records at all, at least one component is a gap.
    expect(overall).toBe("gap");
  });
});
