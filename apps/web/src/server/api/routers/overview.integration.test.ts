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

// The overview surfaces against the real database: a director's trust rollup
// and school drill-down, a DSL's single school, sealed pupil identity, audited
// reads, and cross-trust access denied.

const run = randomUUID().slice(0, 8);

let trustId: string;
let otherSchoolId: string;
let schoolAId: string;
let schoolBId: string;
let director: User;
let dsl: User;

async function contextFor(user: User): Promise<TRPCContext> {
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

async function seedSignal(tenantId: string, upn: string) {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId,
      upn,
      firstName: "Real",
      lastName: "Name",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `ov-${run}-${upn}`,
      version: 1,
      name: "Overview fixture rule",
      description: "fixture",
      params: {},
    },
  });
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId, status: "SUCCEEDED", asOf: new Date() },
  });
  await systemDb.signal.create({
    data: {
      tenantId,
      pupilId: pupil.id,
      ruleVersionId: ruleVersion.id,
      executionId: execution.id,
      severity: 3,
      title: "Attendance and behaviour pattern",
      reasoning: { summary: "fixture", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `Overview Trust ${run}`, slug: `ov-trust-${run}` },
  });
  trustId = trust.id;
  const other = await systemDb.trust.create({
    data: { name: `Other Trust ${run}`, slug: `ov-other-${run}` },
  });

  const schoolA = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `ov-a-${run}`, trustId },
  });
  const schoolB = await systemDb.tenant.create({
    data: { name: "Patcham", slug: `ov-b-${run}`, trustId },
  });
  const otherSchool = await systemDb.tenant.create({
    data: { name: "Elsewhere", slug: `ov-c-${run}`, trustId: other.id },
  });
  schoolAId = schoolA.id;
  schoolBId = schoolB.id;
  otherSchoolId = otherSchool.id;

  director = await systemDb.user.create({
    data: {
      email: `ov-director-${run}@trust.test`,
      name: "Trust Director",
      role: "DIRECTOR",
      trustId,
    },
  });
  dsl = await systemDb.user.create({
    data: {
      email: `ov-dsl-${run}@a.test`,
      name: "School A DSL",
      role: "DSL",
      tenantId: schoolAId,
    },
  });

  await seedSignal(schoolAId, `OVA-${run}`);
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
    where: { slug: { in: [`ov-trust-${run}`, `ov-other-${run}`] } },
  });
});

describe("overview.tenancy", () => {
  it("reports mat mode with every trust school for a director", async () => {
    const caller = createCaller(await contextFor(director));
    const tenancy = await caller.overview.tenancy();
    expect(tenancy.mode).toBe("mat");
    expect(tenancy.schools.map((s) => s.id).sort()).toEqual(
      [schoolAId, schoolBId].sort(),
    );
  });

  it("reports school mode with one school for a DSL", async () => {
    const caller = createCaller(await contextFor(dsl));
    const tenancy = await caller.overview.tenancy();
    expect(tenancy.mode).toBe("school");
    expect(tenancy.schools).toHaveLength(1);
  });
});

describe("overview.trust", () => {
  it("rolls up across the trust's schools for a director", async () => {
    const caller = createCaller(await contextFor(director));
    const result = await caller.overview.trust();
    expect(result.metrics.schools).toBe(2);
    expect(result.metrics.activeConcerns).toBe(1);
    const rowA = result.schools.find((s) => s.id === schoolAId);
    expect(rowA?.dsl).toBe("School A DSL");
    expect(rowA?.activeConcerns).toBe(1);
    // No school from the other trust leaks in.
    expect(result.schools.map((s) => s.id)).not.toContain(otherSchoolId);
  });

  it("is denied to a DSL", async () => {
    const caller = createCaller(await contextFor(dsl));
    await expect(caller.overview.trust()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("overview.school", () => {
  it("seals pupil identity in the pattern list", async () => {
    const caller = createCaller(await contextFor(dsl));
    const result = await caller.overview.school({ schoolId: schoolAId });
    expect(result.metrics.activeConcerns).toBe(1);
    expect(result.patterns).toHaveLength(1);
    const pattern = result.patterns[0]!;
    expect(pattern.ref).toMatch(/^Pupil /);
    // The real name must never appear on this surface.
    expect(JSON.stringify(pattern)).not.toContain("Real");
    expect(JSON.stringify(pattern)).not.toContain("Name");
  });

  it("lets a director drill into any school of their trust", async () => {
    const caller = createCaller(await contextFor(director));
    const result = await caller.overview.school({ schoolId: schoolBId });
    expect(result.school.id).toBe(schoolBId);
  });

  it("denies a director a school outside their trust", async () => {
    const caller = createCaller(await contextFor(director));
    await expect(
      caller.overview.school({ schoolId: otherSchoolId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("writes an audit entry when a school overview is read", async () => {
    const caller = createCaller(await contextFor(dsl));
    await caller.overview.school({ schoolId: schoolAId });
    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "school.overview.viewed" },
    });
    expect(events.length).toBeGreaterThan(0);
  });
});
