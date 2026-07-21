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

function tenantContext(tenantDb: unknown): TRPCContext {
  return {
    db: {} as TRPCContext["db"],
    session: { sessionId: "sess_1", user: tenantUser },
    tenantId: "tenant_a",
    tenantDb: tenantDb as TRPCContext["tenantDb"],
    headers: new Headers(),
  };
}

const events = [
  {
    id: "ev_2",
    createdAt: new Date("2026-07-21T10:05:00Z"),
    action: "signal.viewed",
    entityType: "signal",
    entityId: "sig_1",
    userId: "user_1",
    pupilId: "pupil_1",
    metadata: null,
  },
  {
    id: "ev_1",
    createdAt: new Date("2026-07-21T10:00:00Z"),
    action: "signal.decided",
    entityType: "signal",
    entityId: "sig_1",
    userId: "user_2",
    pupilId: "pupil_gone",
    metadata: { kind: "CONFIRM" },
  },
];

describe("audit.list", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = createCaller({
      db: {} as TRPCContext["db"],
      session: null,
      tenantId: null,
      tenantDb: null,
      headers: new Headers(),
    });
    await expect(caller.audit.list()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("resolves names, labels missing pupils, and audits the view", async () => {
    const auditCreate = vi.fn().mockResolvedValue({});
    const tenantDb = {
      auditEvent: {
        findMany: vi.fn().mockResolvedValue(events),
        count: vi.fn().mockResolvedValue(2),
        groupBy: vi
          .fn()
          .mockResolvedValue([
            { action: "signal.viewed" },
            { action: "signal.decided" },
          ]),
        create: auditCreate,
      },
      user: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "user_1", name: "Test DSL", email: "dsl@x" },
          ]),
      },
      pupil: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "pupil_1", firstName: "Ada", lastName: "Lovelace" },
          ]),
      },
    };

    const caller = createCaller(tenantContext(tenantDb));
    const result = await caller.audit.list({ page: 0 });

    expect(result.total).toBe(2);
    expect(result.availableActions).toEqual([
      "signal.decided",
      "signal.viewed",
    ]);
    expect(result.events[0]).toMatchObject({
      action: "signal.viewed",
      user: "Test DSL",
      pupil: "Ada Lovelace",
    });
    // Unknown user id resolves to a label, deleted pupil is reported.
    expect(result.events[1]).toMatchObject({
      user: "Unknown user",
      pupil: "Pupil no longer on roll",
    });

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "audit.viewed",
          userId: "user_1",
        }),
      }),
    );
  });

  it("passes the action filter through", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const tenantDb = {
      auditEvent: {
        findMany,
        count: vi.fn().mockResolvedValue(0),
        groupBy: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({}),
      },
      user: { findMany: vi.fn().mockResolvedValue([]) },
      pupil: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const caller = createCaller(tenantContext(tenantDb));
    await caller.audit.list({ page: 0, action: "signal.decided" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { action: "signal.decided" } }),
    );
  });
});
