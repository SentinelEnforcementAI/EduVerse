import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Document reader against the real database: read proposes, a person applies,
// and applying advances the referral, files a document and audits.

const run = randomUUID().slice(0, 8);

let schoolId: string;
let dsl: User;
let signalId: string;

async function ctxFor(user: User): Promise<TRPCContext> {
  const tenancy = await resolveTenancy(user);
  return {
    db: systemDb,
    session: { sessionId: `s-${run}`, user },
    tenantId: user.tenantId,
    tenantDb: user.tenantId ? dbForTenant(user.tenantId) : null,
    tenancy,
    headers: new Headers(),
  };
}

beforeAll(async () => {
  const school = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `rd-${run}` },
  });
  schoolId = school.id;
  dsl = await systemDb.user.create({
    data: { email: `rd-dsl-${run}@a.test`, role: "DSL", tenantId: schoolId },
  });
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: schoolId,
      upn: `RD-${run}`,
      firstName: "Test",
      lastName: "Pupil",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  const ruleVersion = await systemDb.ruleVersion.create({
    data: { key: `rd-${run}`, version: 1, name: "Rule", description: "x", params: {} },
  });
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId: schoolId, status: "SUCCEEDED", asOf: new Date() },
  });
  const signal = await systemDb.signal.create({
    data: {
      tenantId: schoolId,
      pupilId: pupil.id,
      ruleVersionId: ruleVersion.id,
      executionId: execution.id,
      severity: 3,
      title: "Pattern",
      reasoning: { summary: "x", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  signalId = signal.id;
});

afterAll(async () => {
  await systemDb.auditEvent.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.document.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.referralEvent.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.referral.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.signal.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { id: dsl.id } });
  await systemDb.tenant.deleteMany({ where: { id: schoolId } });
});

describe("MASH response reader", () => {
  it("requires a referral to read against", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.reader.readMashResponse({ signalId, text: "no further action" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("proposes, then applies to the referral, files a document and audits", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await caller.casework.submitReferral({ signalId });

    const proposal = await caller.reader.readMashResponse({
      signalId,
      text: "Following review, we will convene a strategy discussion next week.",
    });
    expect(proposal.decision).toContain("strategy discussion");

    const applied = await caller.reader.applyMashResponse({
      signalId,
      decision: proposal.decision,
      nextStep: proposal.nextStep,
      rationale: proposal.rationale,
    });
    expect(applied.documentId).toBeTruthy();

    const c = await caller.casework.case({ signalId });
    expect(c.referral.stage).toBe("decided");
    expect(c.referral.decision).toContain("strategy discussion");
    expect(c.documents.some((d) => d.title === "MASH Response")).toBe(true);

    const events = await dbForTenant(schoolId).auditEvent.findMany({
      where: { action: "mash.response.applied" },
    });
    expect(events.length).toBe(1);
  });
});

describe("training certificate reader", () => {
  it("proposes a renewal, then files a training record on apply", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const proposal = await caller.reader.readTrainingCertificate({
      text: "Designated Safeguarding Lead training. Renews January 2028.",
    });
    expect(proposal.renews).toContain("January 2028");

    const applied = await caller.reader.applyTrainingRecord({
      course: proposal.course,
      renews: proposal.renews,
    });
    const doc = await caller.documents.byId({ id: applied.documentId });
    expect(doc.title).toContain("Training Record");
    expect(doc.content).toContain("January 2028");
  });
});
