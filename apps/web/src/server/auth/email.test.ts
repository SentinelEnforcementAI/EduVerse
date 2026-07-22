import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SES_REGION,
  sendMagicLinkEmail,
  setEmailSenderForTesting,
} from "./email";

afterEach(() => {
  setEmailSenderForTesting(null);
  vi.restoreAllMocks();
});

describe("sendMagicLinkEmail", () => {
  it("pins SES to eu-west-2 — UK data residency is not configurable", () => {
    expect(SES_REGION).toBe("eu-west-2");
  });

  it("uses the console transport by default in dev", async () => {
    const consoleSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await sendMagicLinkEmail({
      to: "dsl@downlands.example",
      url: "http://localhost:3000/api/auth/verify?token=abc",
    });

    const output = consoleSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(output).toContain("dsl@downlands.example");
    expect(output).toContain("token=abc");
  });

  it("routes through an injected sender when overridden", async () => {
    const sent: string[] = [];
    setEmailSenderForTesting(async ({ to }) => {
      sent.push(to);
    });
    const consoleSpy = vi
      .spyOn(console, "info")
      .mockImplementation(() => undefined);

    await sendMagicLinkEmail({
      to: "dsl@patcham.example",
      url: "http://localhost:3000/api/auth/verify?token=xyz",
    });

    expect(sent).toEqual(["dsl@patcham.example"]);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
