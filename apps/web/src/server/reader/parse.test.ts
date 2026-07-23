import { describe, expect, it } from "vitest";

import { parseMashResponse, parseTrainingCertificate } from "./parse";

describe("parseMashResponse", () => {
  it("proposes the decision implied by the response", () => {
    expect(parseMashResponse("The case does not meet threshold, no further action.").decision).toContain(
      "No further action",
    );
    expect(parseMashResponse("We will convene a strategy discussion.").decision).toContain(
      "strategy discussion",
    );
    expect(parseMashResponse("A section 47 enquiry will be opened.").decision).toContain(
      "Section 47",
    );
    expect(parseMashResponse("This will proceed as a child and family assessment.").decision).toContain(
      "Assessment",
    );
    expect(parseMashResponse("We are stepping this down to Early Help.").decision).toContain(
      "Early Help",
    );
  });

  it("always proposes a decision and a next step, even for terse text", () => {
    const p = parseMashResponse("Received.");
    expect(p.decision.length).toBeGreaterThan(0);
    expect(p.nextStep.length).toBeGreaterThan(0);
    expect(p.rationale.length).toBeGreaterThan(0);
  });
});

describe("parseTrainingCertificate", () => {
  it("extracts the renewal date and course", () => {
    const p = parseTrainingCertificate(
      "This certifies completion of Designated Safeguarding Lead training. Valid until March 2027.",
    );
    expect(p.renews).toContain("March 2027");
    expect(p.course).toBe("DSL training");
  });

  it("falls back to a year when only a year is present", () => {
    const p = parseTrainingCertificate("Safeguarding training completed in 2025.");
    expect(p.renews).toContain("2025");
    expect(p.course).toContain("safeguarding");
  });
});
