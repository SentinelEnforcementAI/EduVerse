import { describe, expect, it } from "vitest";

import { sealPupilRef } from "@/server/identity";

describe("sealPupilRef", () => {
  it("derives a sealed reference from the UPN, never a name", () => {
    expect(sealPupilRef("SW-DOW-0471")).toBe("Pupil 0471");
    expect(sealPupilRef("SW-PAT-1234")).toBe("Pupil 1234");
  });

  it("is stable for the same UPN", () => {
    expect(sealPupilRef("SW-DOW-0001")).toBe(sealPupilRef("SW-DOW-0001"));
  });

  it("copes with a UPN that has no digits", () => {
    expect(sealPupilRef("ABC")).toBe("Pupil 0000");
  });
});
