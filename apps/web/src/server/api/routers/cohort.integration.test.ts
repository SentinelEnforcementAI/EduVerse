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

// Cross-school cohort intelligence against the real database: a director sees
// the same concern in the same year group across two schools aggregated into
// one pattern (counts only, no pupil), with a by-school breakdown and a
// recommendation. A DSL cannot reach it, and no pupil identity leaks.

const run = randomUUID().slice(0, 8);

let trustId: string;
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

let ruleVersionId: string;

// A behaviour signal for a Year 9 pupil in the given school, against the shared
// run-scoped rule version.
async function seedBehaviourSignal(tenantId: string, upn: string) {
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
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId, status: "SUCCEEDED", asOf: new Date() },
  });
  await systemDb.signal.create({
    data: {
      tenantId,
      pupilId: pupil.id,
      ruleVersionId,
      executionId: execution.id,
      severity: 2,
      title: "Behaviour spike",
      reasoning: { summary: "fixture", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `Cohort Trust ${run}`, slug: `co-trust-${run}` },
  });
  trustId = trust.id;

  const schoolA = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `co-a-${run}`, trustId },
  });
  const schoolB = await systemDb.tenant.create({
    data: { name: "Patcham", slug: `co-b-${run}`, trustId },
  });
  schoolAId = schoolA.id;
  schoolBId = schoolB.id;

  // A run-scoped key that still lands in the "behaviour" domain (domainOf keys
  // off the prefix), so it can never collide with the real seeded rule.
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `behaviour-cohort-${run}`,
      version: 1,
      name: "Behaviour spike",
      description: "fixture",
      params: {},
    },
  });
  ruleVersionId = ruleVersion.id;

  director = await systemDb.user.create({
    data: {
      email: `co-director-${run}@trust.test`,
      name: "Trust Director",
      role: "DIRECTOR",
      trustId,
    },
  });
  dsl = await systemDb.user.create({
    data: {
      email: `co-dsl-${run}@a.test`,
      name: "School A DSL",
      role: "DSL",
      tenantId: schoolAId,
    },
  });

  // Same concern (behaviour), same year group (9), in both schools — a
  // cross-school pattern. Two pupils in school A, one in school B.
  await seedBehaviourSignal(schoolAId, `COA1-${run}`);
  await seedBehaviourSignal(schoolAId, `COA2-${run}`);
  await seedBehaviourSignal(schoolBId, `COB1-${run}`);
});

afterAll(async () => {
  const ids = [schoolAId, schoolBId];
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({
    where: { id: { in: [director.id, dsl.id] } },
  });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({ where: { slug: `co-trust-${run}` } });
});

describe("cohort.patterns", () => {
  it("aggregates the same concern and year group across schools for a director", async () => {
    const caller = createCaller(await contextFor(director));
    const { patterns } = await caller.cohort.patterns();

    const y9 = patterns.find((p) => p.key === "9-behaviour");
    expect(y9).toBeDefined();
    expect(y9!.schools).toBe(2);
    expect(y9!.pupils).toBe(3);
    expect(y9!.title).toContain("Year 9");
    // Counts only — a pattern card must never carry a pupil identity.
    expect(JSON.stringify(y9)).not.toContain("Real");
    expect(JSON.stringify(y9)).not.toContain("Name");
  });

  it("is denied to a DSL", async () => {
    const caller = createCaller(await contextFor(dsl));
    await expect(caller.cohort.patterns()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});

describe("cohort.detail", () => {
  it("returns a by-school breakdown and a recommendation for a director", async () => {
    const caller = createCaller(await contextFor(director));
    const detail = await caller.cohort.detail({ key: "9-behaviour" });

    expect(detail.rows).toHaveLength(2);
    const downlands = detail.rows.find((r) => r.school === "Downlands");
    const patcham = detail.rows.find((r) => r.school === "Patcham");
    expect(downlands?.count).toBe(2);
    expect(patcham?.count).toBe(1);
    // Ordered by count, highest first.
    expect(detail.rows[0]!.count).toBeGreaterThanOrEqual(detail.rows[1]!.count);
    expect(detail.recommendation.length).toBeGreaterThan(0);
    expect(JSON.stringify(detail)).not.toContain("Real");
  });

  it("returns NOT_FOUND for an unknown pattern key", async () => {
    const caller = createCaller(await contextFor(director));
    await expect(
      caller.cohort.detail({ key: "13-attainment" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is denied to a DSL", async () => {
    const caller = createCaller(await contextFor(dsl));
    await expect(
      caller.cohort.detail({ key: "9-behaviour" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
