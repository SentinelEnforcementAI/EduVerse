import { describe, expect, it } from "vitest";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

function publicContext(): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    session: null,
    tenantId: null,
    tenantDb: null,
    tenancy: null,
    headers: new Headers(),
  };
}

describe("health.ping", () => {
  it("answers ok without authentication", async () => {
    const caller = createCaller(publicContext());
    const result = await caller.health.ping();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("sentinel-watch");
    expect(result.echo).toBeNull();
    expect(result.time).toBeInstanceOf(Date);
  });

  it("echoes input back with full type inference", async () => {
    const caller = createCaller(publicContext());
    const result = await caller.health.ping({ echo: "hello" });
    expect(result.echo).toBe("hello");
  });

  it("rejects over-long echo input", async () => {
    const caller = createCaller(publicContext());
    await expect(
      caller.health.ping({ echo: "x".repeat(300) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
