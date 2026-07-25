import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb } from "@sentinel/db";

import { dispatchSeriousSignalAlerts } from "../src/notify/dispatch";
import { setAlertSenderForTesting, type AlertEmail } from "../src/notify/mailer";

// Proactive alerts against the real database with the mailer stubbed: a serious
// signal alerts the school's active DSLs once, sealed; non-serious signals and
// deactivated accounts are skipped; a re-run never re-alerts; a send failure is
// recorded, not lost.

const run = randomUUID().slice(0, 8);

let schoolId: string;
let dslId: string;
let seriousSignalId: string;

async function seedSignal(tenantId: string, tag: string, serious: boolean) {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId,
      upn: `NOTIFY-${tag}-${run}-9931`,
      firstName: "Sensitive",
      lastName: "Realname",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `disclosure-${run}-${tag}`,
      version: 1,
      name: "Disclosure",
      description: "fixture",
      params: {},
    },
  });
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId, status: "SUCCEEDED", asOf: new Date() },
  });
  const signal = await systemDb.signal.create({
    data: {
      tenantId,
      pupilId: pupil.id,
      ruleVersionId: ruleVersion.id,
      executionId: execution.id,
      severity: serious ? 3 : 1,
      serious,
      title: "A concern was raised",
      reasoning: { summary: "x", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  return signal.id;
}

beforeAll(async () => {
  const school = await systemDb.tenant.create({
    data: { name: `Notify School ${run}`, slug: `notify-${run}` },
  });
  schoolId = school.id;

  const dsl = await systemDb.user.create({
    data: {
      email: `notify-dsl-${run}@s.test`,
      role: "DSL",
      tenantId: schoolId,
      status: "ACTIVE",
    },
  });
  dslId = dsl.id;
  // A deactivated DSL must never be alerted.
  await systemDb.user.create({
    data: {
      email: `notify-off-${run}@s.test`,
      role: "DSL",
      tenantId: schoolId,
      status: "DEACTIVATED",
      deactivatedAt: new Date(),
    },
  });

  seriousSignalId = await seedSignal(schoolId, "serious", true);
  await seedSignal(schoolId, "routine", false);
});

afterEach(() => setAlertSenderForTesting(null));

afterAll(async () => {
  await systemDb.notification.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.signal.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: schoolId } });
});

describe("dispatchSeriousSignalAlerts", () => {
  it("alerts the active DSL for a serious signal, sealed, and records it", async () => {
    const sent: AlertEmail[] = [];
    setAlertSenderForTesting(async (email) => {
      sent.push(email);
    });

    const result = await dispatchSeriousSignalAlerts(schoolId);
    expect(result).toEqual({ alerted: 1, failed: 0 });

    // Exactly the active DSL, and the body is sealed (no seeded real name).
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(`notify-dsl-${run}@s.test`);
    expect(sent[0]!.body).toContain("Pupil 9931");
    expect(sent[0]!.body).not.toContain("Realname");

    const notes = await dbForTenant(schoolId).notification.findMany();
    expect(notes).toHaveLength(1);
    expect(notes[0]!.status).toBe("SENT");
    expect(notes[0]!.userId).toBe(dslId);

    const audits = await dbForTenant(schoolId).auditEvent.findMany({
      where: { action: "notification.sent", entityId: seriousSignalId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("does not re-alert on a second run (idempotent)", async () => {
    const sent: AlertEmail[] = [];
    setAlertSenderForTesting(async (email) => {
      sent.push(email);
    });

    const result = await dispatchSeriousSignalAlerts(schoolId);
    expect(result).toEqual({ alerted: 0, failed: 0 });
    expect(sent).toHaveLength(0);

    const notes = await dbForTenant(schoolId).notification.findMany();
    expect(notes).toHaveLength(1); // still just the one from the first run
  });
});

describe("failure handling", () => {
  it("records a FAILED notification (not lost) when the mailer throws", async () => {
    // A fresh serious signal so idempotency doesn't skip it.
    const freshSignalId = await seedSignal(schoolId, "serious2", true);
    setAlertSenderForTesting(async () => {
      throw new Error("SES rejected");
    });

    const result = await dispatchSeriousSignalAlerts(schoolId);
    expect(result.failed).toBeGreaterThanOrEqual(1);

    const failed = await dbForTenant(schoolId).notification.findMany({
      where: { signalId: freshSignalId, status: "FAILED" },
    });
    expect(failed.length).toBe(1);
    const audits = await dbForTenant(schoolId).auditEvent.findMany({
      where: { action: "notification.failed", entityId: freshSignalId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });
});
