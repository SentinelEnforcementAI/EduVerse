import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb, type Tenant, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// The full human-in-the-loop workflow against the real database: decisions
// transition OPEN signals atomically, everything is audited, and the
// decision record is append-only at the DB layer.

const run = randomUUID().slice(0, 8);

let tenant: Tenant;
let dsl: User;
let pupilId: string;
let ruleVersionId: string;
let executionId: string;

async function makeSignal(): Promise<string> {
  const signal = await systemDb.signal.create({
    data: {
      tenantId: tenant.id,
      pupilId,
      ruleVersionId,
      executionId,
      severity: 2,
      title: "Fixture signal",
      reasoning: { summary: "fixture", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 5, 1)),
      windowEnd: new Date(Date.UTC(2026, 6, 21)),
    },
  });
  return signal.id;
}

function caller() {
  const ctx: TRPCContext = {
    db: systemDb,
    session: { sessionId: "sess_test", user: dsl },
    tenantId: tenant.id,
    tenantDb: dbForTenant(tenant.id),
    headers: new Headers(),
  };
  return createCaller(ctx);
}

beforeAll(async () => {
  tenant = await systemDb.tenant.create({
    data: { name: `HITL Test ${run}`, slug: `hitl-test-${run}` },
  });
  dsl = await systemDb.user.create({
    data: {
      email: `dsl-${run}@hitl.test`,
      name: "Test DSL",
      tenantId: tenant.id,
    },
  });
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: tenant.id,
      upn: `HITL-${run}`,
      firstName: "Fixture",
      lastName: "Pupil",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  pupilId = pupil.id;
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `hitl-test-${run}`,
      version: 1,
      name: "HITL fixture rule",
      description: "fixture",
      params: {},
    },
  });
  ruleVersionId = ruleVersion.id;
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId: tenant.id, asOf: new Date(), status: "SUCCEEDED" },
  });
  executionId = execution.id;
});

afterAll(async () => {
  await systemDb.signal.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.ruleVersion.delete({ where: { id: ruleVersionId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.user.delete({ where: { id: dsl.id } });
  await systemDb.tenant.delete({ where: { id: tenant.id } });
  // Decision and audit rows deliberately survive — they are append-only.
});

describe("signals.decide", () => {
  it("confirms a signal: status, decision record, and audit land together", async () => {
    const signalId = await makeSignal();
    const result = await caller().signals.decide({
      signalId,
      kind: "CONFIRM",
      note: "Spoke to head of year, pattern matches home situation.",
    });
    expect(result.status).toBe("CONFIRMED");

    const signal = await systemDb.signal.findUnique({ where: { id: signalId } });
    expect(signal?.status).toBe("CONFIRMED");

    const decision = await systemDb.signalDecision.findUnique({
      where: { id: result.decisionId },
    });
    expect(decision).toMatchObject({
      kind: "CONFIRM",
      userId: dsl.id,
      pupilId,
      signalId,
    });

    const audit = await systemDb.auditEvent.findMany({
      where: { action: "signal.decided", entityId: signalId },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ userId: dsl.id, pupilId });

    // Decision history appears on the detail view, attributed by name.
    const detail = await caller().signals.byId({ id: signalId });
    expect(detail.decisions).toHaveLength(1);
    expect(detail.decisions[0]).toMatchObject({
      kind: "CONFIRM",
      decidedBy: "Test DSL",
    });
  });

  it("refuses to decide an already-decided signal", async () => {
    const signalId = await makeSignal();
    await caller().signals.decide({ signalId, kind: "ESCALATE" });
    await expect(
      caller().signals.decide({ signalId, kind: "CONFIRM" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("requires a note to dismiss", async () => {
    const signalId = await makeSignal();
    await expect(
      caller().signals.decide({ signalId, kind: "DISMISS" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    // Status untouched by the failed attempt.
    const signal = await systemDb.signal.findUnique({ where: { id: signalId } });
    expect(signal?.status).toBe("OPEN");

    const result = await caller().signals.decide({
      signalId,
      kind: "DISMISS",
      note: "Known medical appointments, evidenced by parent letters.",
    });
    expect(result.status).toBe("DISMISSED");
  });

  it("decisions are append-only: no context can modify or delete them", async () => {
    const signalId = await makeSignal();
    const { decisionId } = await caller().signals.decide({
      signalId,
      kind: "CONFIRM",
    });

    await expect(
      systemDb.signalDecision.update({
        where: { id: decisionId },
        data: { note: "tampered" },
      }),
    ).rejects.toThrow();
    await expect(
      systemDb.signalDecision.delete({ where: { id: decisionId } }),
    ).rejects.toThrow();

    // Another tenant cannot see the decision.
    const other = await systemDb.tenant.create({
      data: { name: `HITL Other ${run}`, slug: `hitl-other-${run}` },
    });
    const seen = await dbForTenant(other.id).signalDecision.findMany({
      where: { id: decisionId },
    });
    expect(seen).toHaveLength(0);
    await systemDb.tenant.delete({ where: { id: other.id } });
  });
});
