import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  dbForTenant,
  resolveTenancy,
  systemDb,
  type User,
} from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";
import {
  setCaseEmailSenderForTesting,
  type CaseEmail,
} from "@/server/comms/mailer";

// Case communications (slice 4, phase 1) against the real database, with the
// mail transport stubbed: a human sends a reviewed message, it is threaded to
// the case and audited; a provider failure is recorded, not lost; the timeline
// is sealed; and a DSL from another school cannot reach the case.

const run = randomUUID().slice(0, 8);

let schoolAId: string;
let otherSchoolId: string;
let dsl: User;
let otherDsl: User;
let signalAId: string;

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

async function seedSignal(tenantId: string, tag: string) {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId,
      upn: `MSG-${tag}-${run}`,
      firstName: "Sensitive",
      lastName: "Realname",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `attendance-drop-${run}-${tag}`,
      version: 1,
      name: "Attendance drop",
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
      severity: 3,
      title: "Attendance dropped sharply",
      reasoning: { summary: "x", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  return signal.id;
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `MSG Trust ${run}`, slug: `msg-trust-${run}` },
  });
  const other = await systemDb.trust.create({
    data: { name: `MSG Other ${run}`, slug: `msg-other-${run}` },
  });
  const a = await systemDb.tenant.create({
    data: { name: `Downlands ${run}`, slug: `msg-a-${run}`, trustId: trust.id },
  });
  schoolAId = a.id;
  const o = await systemDb.tenant.create({
    data: { name: `Elsewhere ${run}`, slug: `msg-o-${run}`, trustId: other.id },
  });
  otherSchoolId = o.id;

  dsl = await systemDb.user.create({
    data: {
      email: `msg-dsl-${run}@a.test`,
      name: "A. Lead",
      role: "DSL",
      tenantId: schoolAId,
    },
  });
  otherDsl = await systemDb.user.create({
    data: { email: `msg-dsl-${run}@o.test`, role: "DSL", tenantId: otherSchoolId },
  });

  signalAId = await seedSignal(schoolAId, "a");
});

afterEach(() => setCaseEmailSenderForTesting(null));

afterAll(async () => {
  const ids = [schoolAId, otherSchoolId];
  await systemDb.caseMessage.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({
    where: { slug: { in: [`msg-trust-${run}`, `msg-other-${run}`] } },
  });
});

describe("messages.send", () => {
  it("sends via the transport, threads a SENT message to the case, and audits it", async () => {
    const sent: CaseEmail[] = [];
    setCaseEmailSenderForTesting(async (email) => {
      sent.push(email);
      return { providerMessageId: `prov-${run}` };
    });

    const caller = createCaller(await ctxFor(dsl));
    const result = await caller.messages.send({
      signalId: signalAId,
      commType: "mash",
      to: ["mash@la.gov.uk"],
      subject: "MASH referral",
      body: "Please find our referral attached.",
    });
    expect(result.status).toBe("SENT");

    // The transport received exactly what the DSL confirmed.
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual(["mash@la.gov.uk"]);
    expect(sent[0]!.subject).toBe("MASH referral");

    const message = await systemDb.caseMessage.findUnique({
      where: { id: result.id },
    });
    expect(message?.status).toBe("SENT");
    expect(message?.direction).toBe("OUTBOUND");
    expect(message?.providerMessageId).toBe(`prov-${run}`);
    expect(message?.sentById).toBe(dsl.id);

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "case.message.sent", entityId: signalAId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("records a FAILED message (not lost) and throws when the provider rejects it", async () => {
    setCaseEmailSenderForTesting(async () => {
      throw new Error("SES rejected");
    });

    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.messages.send({
        signalId: signalAId,
        to: ["parent@example.com"],
        subject: "Meeting request",
        body: "Could we meet this week?",
      }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    const failed = await dbForTenant(schoolAId).caseMessage.findMany({
      where: { status: "FAILED" },
    });
    expect(failed.length).toBeGreaterThan(0);
    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "case.message.send_failed", entityId: signalAId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("is denied to a DSL from another school", async () => {
    const caller = createCaller(await ctxFor(otherDsl));
    await expect(
      caller.messages.send({
        signalId: signalAId,
        schoolId: schoolAId,
        to: ["x@example.com"],
        subject: "nope",
        body: "nope",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("messages.list", () => {
  it("returns the timeline newest-first, sealed, with sender names", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const { messages, pupilRef } = await caller.messages.list({
      signalId: signalAId,
    });

    // Sealed: a "Pupil ####" reference, never the seeded real name.
    expect(pupilRef).toMatch(/^Pupil /);
    expect(pupilRef).not.toContain("Realname");

    // Includes the SENT and the FAILED message from the send tests.
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const sentMsg = messages.find((m) => m.status === "SENT");
    expect(sentMsg?.sentBy).toBe("A. Lead");
    expect(sentMsg?.direction).toBe("OUTBOUND");

    // Newest first.
    const times = messages.map((m) => new Date(m.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("is denied to a DSL from another school", async () => {
    const caller = createCaller(await ctxFor(otherDsl));
    await expect(
      caller.messages.list({ signalId: signalAId, schoolId: schoolAId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
