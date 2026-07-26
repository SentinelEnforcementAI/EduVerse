import { describe, expect, it, vi } from "vitest";

import type { User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

const tenantUser: User = {
  id: "user_1",
  email: "dsl@downlands.example.org.uk",
  name: "Test DSL",
  role: "DSL",
  status: "ACTIVE",
  deactivatedAt: null,
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

function tenantContext(tenantDb: unknown): TRPCContext {
  return contextWith({
    session: { sessionId: "sess_1", user: tenantUser },
    tenantId: "tenant_a",
    tenantDb: tenantDb as TRPCContext["tenantDb"],
  });
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
    const caller = createCaller(tenantContext({ signal: { groupBy } }));
    await expect(caller.signals.summary()).resolves.toEqual({
      OPEN: 7,
      CONFIRMED: 0,
      DISMISSED: 2,
      ESCALATED: 0,
    });
  });
});

const listedSignal = {
  id: "sig_1",
  status: "OPEN",
  severity: 3,
  title: "Attendance dropped 34 percentage points",
  updatedAt: new Date("2026-07-20T09:00:00Z"),
  windowEnd: new Date("2026-07-21T00:00:00Z"),
  pupilId: "pupil_1",
  // The DB row carries the name/UPN; the router must never pass them through.
  pupil: {
    id: "pupil_1",
    firstName: "Ada",
    lastName: "Lovelace",
    upn: "SW-DOW-0001",
    yearGroup: 9,
    registrationGroup: "9A",
  },
  ruleVersion: { key: "attendance-drop", name: "Attendance drop", version: 1 },
};

describe("signals.list", () => {
  it("returns open signals and audits the read", async () => {
    const findMany = vi.fn().mockResolvedValue([listedSignal]);
    const auditCreate = vi.fn().mockResolvedValue({});
    const caller = createCaller(
      tenantContext({
        signal: { findMany },
        auditEvent: { create: auditCreate },
      }),
    );

    const result = await caller.signals.list({ status: "OPEN" });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "sig_1",
      severity: 3,
      pupil: { ref: "Pupil 0001", yearGroup: 9 },
      rule: { key: "attendance-drop" },
    });
    // Sealed: no name or UPN reaches this list surface.
    expect(result[0].pupil).not.toHaveProperty("firstName");
    expect(result[0].pupil).not.toHaveProperty("lastName");
    const serialised = JSON.stringify(result[0]);
    expect(serialised).not.toContain("Ada");
    expect(serialised).not.toContain("Lovelace");
    expect(serialised).not.toContain("SW-DOW-0001");

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "signals.listed",
          userId: "user_1",
          tenantId: "tenant_a",
        }),
      }),
    );
  });
});

describe("signals.byId", () => {
  it("returns NOT_FOUND for unknown ids without writing audit", async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const auditCreate = vi.fn();
    const caller = createCaller(
      tenantContext({
        signal: { findUnique },
        auditEvent: { create: auditCreate },
      }),
    );
    await expect(caller.signals.byId({ id: "missing" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns the full signal and audits the pupil-record read", async () => {
    const detail = {
      ...listedSignal,
      reasoning: { summary: "s", metrics: {}, dataPoints: [] },
      pupil: { ...listedSignal.pupil, upn: "SW-DOW-0001" },
      ruleVersion: {
        id: "rv_1",
        key: "attendance-drop",
        name: "Attendance drop",
        version: 1,
        description: "d",
        params: {},
        active: true,
        tenantId: null,
        createdAt: new Date(),
      },
      execution: { id: "exec_1", startedAt: new Date(), asOf: new Date() },
    };
    const findUnique = vi.fn().mockResolvedValue(detail);
    const auditCreate = vi.fn().mockResolvedValue({});
    const caller = createCaller(
      tenantContext({
        signal: { findUnique },
        auditEvent: { create: auditCreate },
        signalDecision: { findMany: vi.fn().mockResolvedValue([]) },
        signalNarrative: { findFirst: vi.fn().mockResolvedValue(null) },
        user: { findMany: vi.fn().mockResolvedValue([]) },
      }),
    );

    const result = await caller.signals.byId({ id: "sig_1" });
    expect(result.id).toBe("sig_1");
    expect(result.decisions).toEqual([]);
    expect(result.narrative).toBeNull();

    // Sealed by default: reference only, no name or UPN in the detail payload.
    expect(result.pupil).toMatchObject({ ref: "Pupil 0001", yearGroup: 9 });
    expect(result.pupil).not.toHaveProperty("firstName");
    expect(result.pupil).not.toHaveProperty("upn");
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("Ada");
    expect(serialised).not.toContain("Lovelace");
    expect(serialised).not.toContain("SW-DOW-0001");

    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "signal.viewed",
          entityId: "sig_1",
          pupilId: "pupil_1",
          userId: "user_1",
        }),
      }),
    );
  });
});
