import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// The human-in-the-loop actions on a case: reveal gated by the action
// threshold and audited, dismiss with a reason, and notes with colleague
// tagging. Identity stays sealed by default and only unseals after a reveal.

const run = randomUUID().slice(0, 8);

let schoolAId: string;
let otherSchoolId: string;
let dsl: User;
let colleague: User;
let level3SignalId: string;
let level2SignalId: string;

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

async function seedSignal(tenantId: string, tag: string, severity: 1 | 2 | 3) {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId,
      upn: `HL-${tag}-${run}`,
      firstName: "Aiden",
      lastName: "Cole",
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
      severity,
      title: "Attendance pattern",
      reasoning: { summary: "fixture", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  return signal.id;
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `HL Trust ${run}`, slug: `hl-trust-${run}` },
  });
  const a = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `hl-a-${run}`, trustId: trust.id },
  });
  const o = await systemDb.tenant.create({
    data: { name: "Elsewhere", slug: `hl-o-${run}` },
  });
  schoolAId = a.id;
  otherSchoolId = o.id;

  dsl = await systemDb.user.create({
    data: { email: `hl-dsl-${run}@a.test`, name: "A DSL", role: "DSL", tenantId: schoolAId },
  });
  colleague = await systemDb.user.create({
    data: {
      email: `hl-col-${run}@a.test`,
      name: "A Deputy",
      role: "DSL",
      tenantId: schoolAId,
    },
  });

  level3SignalId = await seedSignal(schoolAId, "l3", 3);
  level2SignalId = await seedSignal(schoolAId, "l2", 2);
});

afterAll(async () => {
  const ids = [schoolAId, otherSchoolId];
  await systemDb.caseNote.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.signalDecision.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { id: { in: [dsl.id, colleague.id] } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({ where: { slug: `hl-trust-${run}` } });
});

describe("reveal (gated, audited)", () => {
  it("is denied below the action threshold (level 2)", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.casework.reveal({
        signalId: level2SignalId,
        reason: "Required for a referral",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("is sealed by default and unseals only after an audited reveal", async () => {
    const caller = createCaller(await ctxFor(dsl));

    const before = await caller.casework.case({ signalId: level3SignalId });
    expect(before.revealed).toBe(false);
    expect(before.pupilName).toBeNull();
    expect(before.revealable).toBe(true);
    expect(JSON.stringify(before)).not.toContain("Aiden");

    await caller.casework.reveal({
      signalId: level3SignalId,
      reason: "Required for parental contact",
    });

    const after = await caller.casework.case({ signalId: level3SignalId });
    expect(after.revealed).toBe(true);
    expect(after.pupilName).toBe("Aiden Cole");

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: {
        action: "pupil.identity.revealed",
        entityId: level3SignalId,
      },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.metadata).toMatchObject({
      reason: "Required for parental contact",
    });
  });
});

describe("dismiss (reason required, audited)", () => {
  it("rejects a reason that is too short", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.casework.dismiss({ signalId: level2SignalId, reason: "no" }),
    ).rejects.toBeTruthy();
  });

  it("closes the signal with a reason and audits it", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const result = await caller.casework.dismiss({
      signalId: level2SignalId,
      reason: "Reviewed with the family, no further concern at this time.",
    });
    expect(result.status).toBe("DISMISSED");

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "signal.decided", entityId: level2SignalId },
    });
    expect(events.length).toBeGreaterThan(0);
  });
});

describe("notes with tagging (append-only, audited)", () => {
  it("lists taggable colleagues at the school, excluding the caller", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const directory = await caller.casework.directory({});
    expect(directory.map((c) => c.name)).toContain("A Deputy");
    expect(directory.map((c) => c.id)).not.toContain(dsl.id);
  });

  it("adds a note tagging a colleague, audited, and surfaces it on the case", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await caller.casework.addNote({
      signalId: level3SignalId,
      body: "Spoke to form tutor, arranging a check-in.",
      taggedUserIds: [colleague.id],
    });

    const c = await caller.casework.case({ signalId: level3SignalId });
    expect(c.notes).toHaveLength(1);
    expect(c.notes[0]!.author).toBe("A DSL");
    expect(c.notes[0]!.tagged).toContain("A Deputy");

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "case.note.added", entityId: level3SignalId },
    });
    expect(events.length).toBeGreaterThan(0);
  });

  it("keeps notes scoped to their school (RLS)", async () => {
    // Another school's context sees none of school A's notes.
    const notes = await dbForTenant(otherSchoolId).caseNote.findMany({
      where: { signalId: level3SignalId },
    });
    expect(notes).toHaveLength(0);
  });
});
