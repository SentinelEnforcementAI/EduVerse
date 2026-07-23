import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@prisma/client";

import { dbForTenant, resolveTenancy, systemDb } from "../src";

// Proves the MAT reframe keeps isolation intact: a director sees exactly the
// schools of their own trust and no others, the trusts table is gated by RLS,
// and per-school reads stay scoped even when a director fans out across them.

const run = randomUUID().slice(0, 8);

let trust1Id: string;
let trust2Id: string;
let schoolA: { id: string };
let schoolB: { id: string };
let schoolC: { id: string };
let directorId: string;
let dslId: string;

beforeAll(async () => {
  const trust1 = await systemDb.trust.create({
    data: { name: `Trust One ${run}`, slug: `trust-one-${run}` },
  });
  const trust2 = await systemDb.trust.create({
    data: { name: `Trust Two ${run}`, slug: `trust-two-${run}` },
  });
  trust1Id = trust1.id;
  trust2Id = trust2.id;

  schoolA = await systemDb.tenant.create({
    data: { name: "School A", slug: `school-a-${run}`, trustId: trust1Id },
  });
  schoolB = await systemDb.tenant.create({
    data: { name: "School B", slug: `school-b-${run}`, trustId: trust1Id },
  });
  // School C belongs to a DIFFERENT trust — must never surface for trust 1.
  schoolC = await systemDb.tenant.create({
    data: { name: "School C", slug: `school-c-${run}`, trustId: trust2Id },
  });

  const director = await systemDb.user.create({
    data: {
      email: `director-${run}@trust-one.test`,
      role: "DIRECTOR",
      trustId: trust1Id,
    },
  });
  directorId = director.id;

  const dsl = await systemDb.user.create({
    data: {
      email: `dsl-${run}@school-a.test`,
      role: "DSL",
      tenantId: schoolA.id,
    },
  });
  dslId = dsl.id;

  // A pupil in each of the two trust-1 schools and one in trust 2.
  for (const [tenantId, tag] of [
    [schoolA.id, "a"],
    [schoolB.id, "b"],
    [schoolC.id, "c"],
  ] as const) {
    await systemDb.pupil.create({
      data: {
        tenantId,
        upn: `TEN-${tag}-${run}`,
        firstName: "Fixture",
        lastName: "Pupil",
        yearGroup: 9,
        registrationGroup: "9A",
        dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
      },
    });
  }
});

afterAll(async () => {
  await systemDb.pupil.deleteMany({
    where: { tenantId: { in: [schoolA.id, schoolB.id, schoolC.id] } },
  });
  await systemDb.user.deleteMany({ where: { id: { in: [directorId, dslId] } } });
  await systemDb.tenant.deleteMany({
    where: { id: { in: [schoolA.id, schoolB.id, schoolC.id] } },
  });
  await systemDb.trust.deleteMany({ where: { id: { in: [trust1Id, trust2Id] } } });
});

describe("resolveTenancy", () => {
  it("a director sees exactly the schools of their own trust", async () => {
    const director = await systemDb.user.findUniqueOrThrow({
      where: { id: directorId },
    });
    const tenancy = await resolveTenancy(director);
    expect(tenancy.mode).toBe("mat");
    expect(tenancy.trustId).toBe(trust1Id);
    expect(tenancy.schools.map((s) => s.id).sort()).toEqual(
      [schoolA.id, schoolB.id].sort(),
    );
    // School C (other trust) must not appear.
    expect(tenancy.schools.map((s) => s.id)).not.toContain(schoolC.id);
  });

  it("a DSL sees only their own school", async () => {
    const dsl = await systemDb.user.findUniqueOrThrow({ where: { id: dslId } });
    const tenancy = await resolveTenancy(dsl);
    expect(tenancy.mode).toBe("school");
    expect(tenancy.schools.map((s) => s.id)).toEqual([schoolA.id]);
  });

  it("a director of an unknown trust sees no schools", async () => {
    const tenancy = await resolveTenancy({
      role: "DIRECTOR",
      tenantId: null,
      trustId: `missing-${run}`,
    });
    expect(tenancy.schools).toHaveLength(0);
  });
});

describe("trusts table RLS", () => {
  it("a school's tenant context reads only its own trust", async () => {
    const trusts = await dbForTenant(schoolA.id).trust.findMany();
    expect(trusts.map((t) => t.id)).toEqual([trust1Id]);
  });

  it("a school cannot read a different trust's row", async () => {
    const other = await dbForTenant(schoolA.id).trust.findUnique({
      where: { id: trust2Id },
    });
    expect(other).toBeNull();
  });

  it("an unscoped client sees no trusts", async () => {
    const raw = new PrismaClient();
    try {
      await expect(raw.trust.findMany()).resolves.toHaveLength(0);
    } finally {
      await raw.$disconnect();
    }
  });

  it("a tenant context cannot create or rename a trust", async () => {
    await expect(
      dbForTenant(schoolA.id).trust.create({
        data: { name: "Rogue Trust", slug: `rogue-${run}` },
      }),
    ).rejects.toThrow();
    await expect(
      dbForTenant(schoolA.id).trust.updateMany({
        where: { id: trust1Id },
        data: { name: "Renamed" },
      }),
    ).rejects.toThrow();
  });
});

describe("director fan-out stays school-scoped", () => {
  it("reading each trust school never crosses into another school's pupils", async () => {
    const aPupils = await dbForTenant(schoolA.id).pupil.findMany();
    const bPupils = await dbForTenant(schoolB.id).pupil.findMany();
    expect(aPupils).toHaveLength(1);
    expect(bPupils).toHaveLength(1);
    expect(aPupils[0]!.upn).toContain("-a-");
    expect(bPupils[0]!.upn).toContain("-b-");
    // Neither school's context can see the other-trust school's pupil.
    expect(
      await dbForTenant(schoolA.id).pupil.findFirst({
        where: { upn: `TEN-c-${run}` },
      }),
    ).toBeNull();
  });
});
