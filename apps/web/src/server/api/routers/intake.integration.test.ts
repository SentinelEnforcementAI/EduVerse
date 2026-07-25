import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dbForTenant,
  resolveTenancy,
  systemDb,
  type User,
} from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// The intake queue against the real database: a DSL sees pending inbound mail
// and the open cases to assign to (sealed), assigns an item (creating an INBOUND
// message on the case, audited), dismisses another, and a DSL from another
// school cannot reach it.

const run = randomUUID().slice(0, 8);

let schoolAId: string;
let otherSchoolId: string;
let dsl: User;
let otherDsl: User;
let signalId: string;
let pupilRefLast4: string;

async function ctxFor(user: User): Promise<TRPCContext> {
  const tenancy = await resolveTenancy(user);
  return {
    db: systemDb,
    session: { sessionId: `sess-${run}`, user },
    tenantId: user.tenantId,
    tenantDb: user.tenantId ? dbForTenant(user.tenantId) : null,
    tenancy,
    headers: new Headers(),
  };
}

async function intakeItem(tenantId: string, subject: string) {
  return systemDb.intakeItem.create({
    data: {
      tenantId,
      fromAddress: "teacher@school.test",
      toAddress: "safeguarding@school.test",
      subject,
      body: "A concern.",
      receivedAt: new Date(),
    },
  });
}

beforeAll(async () => {
  const a = await systemDb.tenant.create({
    data: { name: `Intake A ${run}`, slug: `intk-a-${run}` },
  });
  schoolAId = a.id;
  const o = await systemDb.tenant.create({
    data: { name: `Intake O ${run}`, slug: `intk-o-${run}` },
  });
  otherSchoolId = o.id;

  dsl = await systemDb.user.create({
    data: { email: `intk-dsl-${run}@a.test`, role: "DSL", tenantId: schoolAId },
  });
  otherDsl = await systemDb.user.create({
    data: { email: `intk-dsl-${run}@o.test`, role: "DSL", tenantId: otherSchoolId },
  });

  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: schoolAId,
      upn: `INTK-${run}-8080`,
      firstName: "Sensitive",
      lastName: "Realname",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  pupilRefLast4 = "8080";
  const ruleVersion = await systemDb.ruleVersion.create({
    data: { key: `intk-${run}`, version: 1, name: "x", description: "x", params: {} },
  });
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId: schoolAId, status: "SUCCEEDED", asOf: new Date() },
  });
  const signal = await systemDb.signal.create({
    data: {
      tenantId: schoolAId,
      pupilId: pupil.id,
      ruleVersionId: ruleVersion.id,
      executionId: execution.id,
      severity: 2,
      title: "A concern",
      reasoning: { summary: "x", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 1)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  signalId = signal.id;
});

afterAll(async () => {
  const ids = [schoolAId, otherSchoolId];
  await systemDb.caseMessage.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.intakeItem.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
});

describe("intake.list", () => {
  it("returns pending items and sealed open cases; sealed, not named", async () => {
    await intakeItem(schoolAId, `Query ${run}`);
    const caller = createCaller(await ctxFor(dsl));
    const { items, cases } = await caller.intake.list({ schoolId: schoolAId });

    expect(items.some((i) => i.subject === `Query ${run}`)).toBe(true);
    const theCase = cases.find((c) => c.signalId === signalId);
    expect(theCase).toBeTruthy();
    expect(theCase!.ref).toMatch(/^Pupil /);
    expect(theCase!.ref).toContain(pupilRefLast4);
    expect(theCase!.ref).not.toContain("Realname");
  });

  it("is denied to a DSL from another school", async () => {
    const caller = createCaller(await ctxFor(otherDsl));
    await expect(
      caller.intake.list({ schoolId: schoolAId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("intake.assign / dismiss", () => {
  it("assigns an item to a case as an INBOUND message, and audits it", async () => {
    const item = await intakeItem(schoolAId, `Assign me ${run}`);
    const caller = createCaller(await ctxFor(dsl));
    const { id } = await caller.intake.assign({
      intakeItemId: item.id,
      signalId,
      schoolId: schoolAId,
    });

    const msg = await systemDb.caseMessage.findUnique({ where: { id } });
    expect(msg?.direction).toBe("INBOUND");
    expect(msg?.signalId).toBe(signalId);

    const updated = await systemDb.intakeItem.findUnique({ where: { id: item.id } });
    expect(updated?.status).toBe("ASSIGNED");
    expect(updated?.assignedSignalId).toBe(signalId);

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "intake.assigned", entityId: signalId },
    });
    expect(audits.length).toBeGreaterThan(0);

    // No longer pending → gone from the queue.
    const { items } = await caller.intake.list({ schoolId: schoolAId });
    expect(items.some((i) => i.id === item.id)).toBe(false);
  });

  it("dismisses an item (kept, marked dismissed) and audits it", async () => {
    const item = await intakeItem(schoolAId, `Dismiss me ${run}`);
    const caller = createCaller(await ctxFor(dsl));
    await caller.intake.dismiss({ intakeItemId: item.id, schoolId: schoolAId });

    const updated = await systemDb.intakeItem.findUnique({ where: { id: item.id } });
    expect(updated?.status).toBe("DISMISSED");

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "intake.dismissed", entityId: item.id },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("cannot assign an item from another school", async () => {
    const foreign = await intakeItem(otherSchoolId, `Foreign ${run}`);
    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.intake.assign({
        intakeItemId: foreign.id,
        signalId,
        schoolId: schoolAId,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
