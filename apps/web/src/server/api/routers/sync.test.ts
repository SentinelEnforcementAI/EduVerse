import { describe, expect, it, vi } from "vitest";

import type { User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

const tenantUser: User = {
  id: "user_1",
  email: "dsl@downlands.example.org.uk",
  name: "Test DSL",
  role: "DSL",
  trustId: null,
  tenantId: "tenant_a",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

function contextWith(overrides: Partial<TRPCContext>): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    session: null,
    tenantId: null,
    tenantDb: null,
    tenancy: null,
    headers: new Headers(),
    ...overrides,
  };
}

describe("sync.status", () => {
  it("rejects users without a tenant", async () => {
    const caller = createCaller(
      contextWith({
        session: {
          sessionId: "sess_1",
          user: { ...tenantUser, tenantId: null },
        },
      }),
    );
    await expect(caller.sync.status()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("returns the latest run per type, null where never synced", async () => {
    const now = new Date("2026-07-21T10:00:00Z");
    const earlier = new Date("2026-07-20T10:00:00Z");
    const findMany = vi.fn().mockResolvedValue([
      {
        type: "STUDENTS",
        status: "SUCCEEDED",
        queuedAt: now,
        finishedAt: now,
        stats: { created: 3, updated: 0, skipped: 0 },
        error: null,
      },
      {
        type: "STUDENTS",
        status: "FAILED",
        queuedAt: earlier,
        finishedAt: earlier,
        stats: null,
        error: "boom",
      },
      {
        type: "ATTENDANCE",
        status: "FAILED",
        queuedAt: earlier,
        finishedAt: earlier,
        stats: null,
        error: "no key",
      },
    ]);

    const caller = createCaller(
      contextWith({
        session: { sessionId: "sess_1", user: tenantUser },
        tenantId: "tenant_a",
        tenantDb: {
          syncRun: { findMany },
        } as unknown as TRPCContext["tenantDb"],
      }),
    );

    const status = await caller.sync.status();
    expect(status).toHaveLength(4);
    // Latest STUDENTS run wins (list is queuedAt desc).
    expect(status[0]).toMatchObject({ type: "STUDENTS", status: "SUCCEEDED" });
    expect(status[1]).toMatchObject({ type: "ATTENDANCE", status: "FAILED", error: "no key" });
    expect(status[2]).toMatchObject({ type: "BEHAVIOUR", status: null });
    expect(status[3]).toMatchObject({ type: "ATTAINMENT", status: null });
  });
});
