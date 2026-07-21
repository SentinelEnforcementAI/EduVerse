import { describe, expect, it, vi } from "vitest";

import type { User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

const tenantUser: User = {
  id: "user_1",
  email: "dsl@downlands.example.org.uk",
  name: "Test DSL",
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
    headers: new Headers(),
    ...overrides,
  };
}

describe("signals.summary", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(contextWith({}));
    await expect(caller.signals.summary()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("returns zeroed counts for statuses with no signals", async () => {
    const groupBy = vi.fn().mockResolvedValue([
      { status: "OPEN", _count: { _all: 7 } },
      { status: "DISMISSED", _count: { _all: 2 } },
    ]);
    const caller = createCaller(
      contextWith({
        session: { sessionId: "sess_1", user: tenantUser },
        tenantId: "tenant_a",
        tenantDb: { signal: { groupBy } } as unknown as TRPCContext["tenantDb"],
      }),
    );
    await expect(caller.signals.summary()).resolves.toEqual({
      OPEN: 7,
      CONFIRMED: 0,
      DISMISSED: 2,
      ESCALATED: 0,
    });
  });
});
