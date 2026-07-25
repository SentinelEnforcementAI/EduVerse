import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb } from "@sentinel/db";

import { ingestInbound } from "../src/mailbox/ingest";
import type { InboundMessage } from "../src/mailbox/connector";

// Inbound capture against the real database (commercialisation slice 4, phase
// 2): a message is matched to a case by thread or by a sealed pupil reference
// and recorded as an INBOUND CaseMessage; an unmatched message lands in the
// intake queue; and ingestion is idempotent by the provider message id.

const run = randomUUID().slice(0, 8);

let schoolId: string;
let pupilId: string;
let signalId: string;

function inbound(overrides: Partial<InboundMessage>): InboundMessage {
  return {
    from: "teacher@school.test",
    to: "safeguarding@school.test",
    subject: "A concern",
    body: "Please see below.",
    threadId: null,
    providerMessageId: `pm-${randomUUID().slice(0, 8)}`,
    receivedAt: new Date(),
    ...overrides,
  };
}

beforeAll(async () => {
  const school = await systemDb.tenant.create({
    data: { name: `Intake School ${run}`, slug: `intake-${run}` },
  });
  schoolId = school.id;

  // A pupil whose sealed reference is "Pupil 4242" (UPN ends 4242).
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: schoolId,
      upn: `INB-${run}-4242`,
      firstName: "Sensitive",
      lastName: "Realname",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  pupilId = pupil.id;
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `inbound-${run}`,
      version: 1,
      name: "x",
      description: "x",
      params: {},
    },
  });
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId: schoolId, status: "SUCCEEDED", asOf: new Date() },
  });
  const signal = await systemDb.signal.create({
    data: {
      tenantId: schoolId,
      pupilId,
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
  await systemDb.caseMessage.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.intakeItem.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.signal.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: schoolId } });
});

describe("ingestInbound", () => {
  it("matches by a sealed pupil reference and records an INBOUND message, audited", async () => {
    const result = await ingestInbound(
      schoolId,
      inbound({ subject: "Re: Pupil 4242", body: "I'm worried about them." }),
    );
    expect(result.outcome).toBe("matched");
    if (result.outcome !== "matched") return;
    expect(result.signalId).toBe(signalId);

    const msg = await systemDb.caseMessage.findUnique({
      where: { id: result.caseMessageId },
    });
    expect(msg?.direction).toBe("INBOUND");
    expect(msg?.pupilId).toBe(pupilId);

    const audits = await dbForTenant(schoolId).auditEvent.findMany({
      where: { action: "case.message.received", entityId: signalId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("matches a reply by thread onto the same case", async () => {
    // Seed a prior message on the case with a known thread id.
    const thread = `thr-${run}`;
    await systemDb.caseMessage.create({
      data: {
        tenantId: schoolId,
        signalId,
        pupilId,
        direction: "OUTBOUND",
        status: "SENT",
        fromAddress: "safeguarding@school.test",
        toAddresses: ["mash@la.test"],
        subject: "Referral",
        body: "x",
        threadId: thread,
      },
    });

    const result = await ingestInbound(
      schoolId,
      inbound({ subject: "No pupil ref here", threadId: thread }),
    );
    expect(result.outcome).toBe("matched");
    if (result.outcome === "matched") expect(result.signalId).toBe(signalId);
  });

  it("routes an unmatched message to the intake queue, audited", async () => {
    const result = await ingestInbound(
      schoolId,
      inbound({ subject: "General query", body: "No reference at all." }),
    );
    expect(result.outcome).toBe("intake");
    if (result.outcome !== "intake") return;

    const item = await systemDb.intakeItem.findUnique({
      where: { id: result.intakeItemId },
    });
    expect(item?.status).toBe("PENDING");

    const audits = await dbForTenant(schoolId).auditEvent.findMany({
      where: { action: "intake.received", entityId: result.intakeItemId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("is idempotent: the same provider message id is never ingested twice", async () => {
    const pm = `pm-fixed-${run}`;
    const first = await ingestInbound(schoolId, inbound({ providerMessageId: pm }));
    expect(first.outcome).toBe("intake");
    const second = await ingestInbound(schoolId, inbound({ providerMessageId: pm }));
    expect(second.outcome).toBe("duplicate");
  });
});
