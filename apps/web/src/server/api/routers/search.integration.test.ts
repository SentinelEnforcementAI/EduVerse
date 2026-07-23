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

// Global search against the real database: matches a school name, a concern
// headline and a sealed reference number, all within the caller's scope. A
// director searches across the trust; a DSL only their own school; and no
// result ever carries a pupil name.

const run = randomUUID().slice(0, 8);

let trustId: string;
let schoolAId: string;
let schoolBId: string;
let director: User;
let dsl: User;
let ruleVersionId: string;

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

async function seedSignal(
  tenantId: string,
  upn: string,
  title: string,
  severity = 3,
) {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId,
      upn,
      firstName: "Zephyrine",
      lastName: "Quixworth",
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
      severity,
      title,
      reasoning: { summary: "fixture", metrics: {}, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `Search Trust ${run}`, slug: `se-trust-${run}` },
  });
  trustId = trust.id;

  const schoolA = await systemDb.tenant.create({
    data: { name: `Downlands ${run}`, slug: `se-a-${run}`, trustId },
  });
  const schoolB = await systemDb.tenant.create({
    data: { name: `Patcham ${run}`, slug: `se-b-${run}`, trustId },
  });
  schoolAId = schoolA.id;
  schoolBId = schoolB.id;

  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `search-${run}`,
      version: 1,
      name: "Search fixture rule",
      description: "fixture",
      params: {},
    },
  });
  ruleVersionId = ruleVersion.id;

  director = await systemDb.user.create({
    data: {
      email: `se-director-${run}@trust.test`,
      name: "Trust Director",
      role: "DIRECTOR",
      trustId,
    },
  });
  dsl = await systemDb.user.create({
    data: {
      email: `se-dsl-${run}@a.test`,
      name: "School A DSL",
      role: "DSL",
      tenantId: schoolAId,
    },
  });

  // The seal takes the last four digits, so put them last: "Pupil 7777".
  await seedSignal(schoolAId, `SEA-${run}-7777`, "Online safety disclosure");
  await seedSignal(schoolBId, `SEB-${run}-2222`, "Attendance dropped sharply");
});

afterAll(async () => {
  const ids = [schoolAId, schoolBId];
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleVersion.deleteMany({ where: { key: `search-${run}` } });
  await systemDb.user.deleteMany({
    where: { id: { in: [director.id, dsl.id] } },
  });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({ where: { slug: `se-trust-${run}` } });
});

describe("search.query", () => {
  it("matches a sealed reference number without exposing a name", async () => {
    const caller = createCaller(await contextFor(director));
    const res = await caller.search.query({ q: "7777" });
    const hit = res.concerns.find((c) => c.ref === "Pupil 7777");
    expect(hit).toBeDefined();
    expect(hit!.schoolName).toContain("Downlands");
    expect(JSON.stringify(res)).not.toContain("Zephyrine");
    expect(JSON.stringify(res)).not.toContain("Quixworth");
  });

  it("matches a concern headline", async () => {
    const caller = createCaller(await contextFor(director));
    const res = await caller.search.query({ q: "online safety" });
    expect(res.concerns.some((c) => c.headline === "Online safety disclosure")).toBe(
      true,
    );
  });

  it("matches a school name", async () => {
    const caller = createCaller(await contextFor(director));
    const res = await caller.search.query({ q: "patcham" });
    expect(res.schools.some((s) => s.name.includes("Patcham"))).toBe(true);
  });

  it("scopes a DSL to their own school only", async () => {
    const caller = createCaller(await contextFor(dsl));
    // The DSL is in school A; a school-B concern must never surface.
    const res = await caller.search.query({ q: "attendance dropped sharply" });
    expect(res.concerns).toHaveLength(0);
  });

  it("returns nothing for a query shorter than two characters", async () => {
    const caller = createCaller(await contextFor(director));
    const res = await caller.search.query({ q: "a" });
    expect(res.concerns).toHaveLength(0);
    expect(res.schools).toHaveLength(0);
  });
});
