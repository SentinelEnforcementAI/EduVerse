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

// Triage and the read-only case view against the real database: sealed identity
// throughout, source-attributed timeline, escalation level with route, a
// computed time-to-surface, audited reads, and cross-trust access denied.

const run = randomUUID().slice(0, 8);

let trustId: string;
let schoolAId: string;
let schoolBId: string;
let otherSchoolId: string;
let director: User;
let dsl: User;
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

async function seedSignal(tenantId: string, tag: string, severity: 1 | 2 | 3) {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId,
      upn: `CW-${tag}-${run}`,
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
      severity,
      title: "Attendance dropped 37 percentage points",
      reasoning: {
        summary: "Attendance has fallen sharply from this pupil's baseline.",
        metrics: { dropPercentagePoints: 37, thresholdDropPercentagePoints: 15 },
        dataPoints: [
          { label: "AM absence (code O, unauthorised)", date: "2026-04-14", value: "O" },
          { label: "AM absence (code I, authorised)", date: "2026-04-22", value: "I" },
        ],
      },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  return signal.id;
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `CW Trust ${run}`, slug: `cw-trust-${run}` },
  });
  trustId = trust.id;
  const other = await systemDb.trust.create({
    data: { name: `CW Other ${run}`, slug: `cw-other-${run}` },
  });

  const a = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `cw-a-${run}`, trustId },
  });
  const b = await systemDb.tenant.create({
    data: { name: "Patcham", slug: `cw-b-${run}`, trustId },
  });
  const o = await systemDb.tenant.create({
    data: { name: "Elsewhere", slug: `cw-o-${run}`, trustId: other.id },
  });
  schoolAId = a.id;
  schoolBId = b.id;
  otherSchoolId = o.id;

  director = await systemDb.user.create({
    data: { email: `cw-dir-${run}@t.test`, role: "DIRECTOR", trustId },
  });
  dsl = await systemDb.user.create({
    data: { email: `cw-dsl-${run}@a.test`, role: "DSL", tenantId: schoolAId },
  });

  signalAId = await seedSignal(schoolAId, "a", 3);
  await seedSignal(schoolBId, "b", 2);
});

afterAll(async () => {
  const ids = [schoolAId, schoolBId, otherSchoolId];
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { id: { in: [director.id, dsl.id] } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({
    where: { slug: { in: [`cw-trust-${run}`, `cw-other-${run}`] } },
  });
});

describe("casework.triage", () => {
  it("returns sealed rows with an escalation level at school scope", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const result = await caller.casework.triage({ key: "active" });
    expect(result.scope).toBe("school");
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0]!;
    expect(row.ref).toMatch(/^Pupil /);
    expect(row.level).toBe(3);
    expect(JSON.stringify(row)).not.toContain("Realname");
  });

  it("spans the trust for a director, sorted by level", async () => {
    const caller = createCaller(await ctxFor(director));
    const result = await caller.casework.triage({ key: "active" });
    expect(result.scope).toBe("trust");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.level).toBeGreaterThanOrEqual(result.rows[1]!.level);
    expect(result.rows.map((r) => r.schoolName).sort()).toEqual([
      "Downlands",
      "Patcham",
    ]);
  });
});

describe("casework.case", () => {
  it("returns a sealed, source-attributed case with a route and time to surface", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const c = await caller.casework.case({ signalId: signalAId });
    expect(c.ref).toMatch(/^Pupil /);
    expect(JSON.stringify(c)).not.toContain("Realname");
    expect(c.escalation.level).toBe(3);
    expect(c.escalation.route.length).toBeGreaterThan(0);
    expect(c.timeline[0]!.source).toBe("Attendance");
    // Level 3 cadence is 20 days; a 14-day pattern surfaces 6 days before the
    // next review would have connected the signals.
    expect(c.timeToSurface?.days).toBe(6);
    expect(c.timeToSurface?.cadenceLabel).toContain("multi-agency");
  });

  it("audits the read against the pupil's record", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await caller.casework.case({ signalId: signalAId });
    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "case.viewed", entityId: signalAId },
    });
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]!.pupilId).not.toBeNull();
  });

  it("denies a director a case in a school outside their trust", async () => {
    const caller = createCaller(await ctxFor(director));
    await expect(
      caller.casework.case({ signalId: signalAId, schoolId: otherSchoolId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns non-identifying context while sealed, but the snapshot only once revealed", async () => {
    const signalId = await seedSignal(schoolAId, "ctx", 3);
    const sig = await systemDb.signal.findUnique({
      where: { id: signalId },
      select: { pupilId: true },
    });
    await systemDb.pupil.update({
      where: { id: sig!.pupilId },
      data: {
        pupilPremium: true,
        freeSchoolMeals: true,
        senStatus: "EHCP",
        youngCarer: true,
        preferredName: "Sealedname",
        firstLanguage: "Polish",
        house: "Rivers",
      },
    });

    const caller = createCaller(await ctxFor(dsl));

    // Sealed: the statutory context is present (it does not identify the child),
    // but no personal snapshot leaves the server.
    const sealed = await caller.casework.case({ signalId });
    expect(sealed.revealed).toBe(false);
    expect(sealed.context.pupilPremium).toBe(true);
    expect(sealed.context.senStatus).toBe("EHCP");
    expect(sealed.context.youngCarer).toBe(true);
    expect(sealed.snapshot).toBeNull();
    // The identifying snapshot values must not appear anywhere while sealed.
    expect(JSON.stringify(sealed)).not.toContain("Sealedname");
    expect(JSON.stringify(sealed)).not.toContain("Polish");
    // A serious/level-3 case produces a domain risk-factor breakdown.
    expect(sealed.riskFactors.length).toBeGreaterThan(0);
    expect(sealed.lifecycle[0]!.key).toBe("raised");

    // After a recorded reveal, the snapshot is returned; context is unchanged.
    await caller.casework.reveal({
      signalId,
      reason: "Safeguarding decision recorded",
    });
    const revealed = await caller.casework.case({ signalId });
    expect(revealed.revealed).toBe(true);
    expect(revealed.snapshot?.preferredName).toBe("Sealedname");
    expect(revealed.snapshot?.firstLanguage).toBe("Polish");
    expect(revealed.context.pupilPremium).toBe(true);
  });
});
