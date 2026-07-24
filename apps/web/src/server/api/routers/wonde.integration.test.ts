import { randomUUID } from "node:crypto";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  dbForTenant,
  resolveTenancy,
  systemDb,
  type User,
} from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Wonde self-connect against the real database, with the Wonde directory (the
// only network dependency) mocked: an admin links and unlinks its own trust's
// schools; links are validated against the reachable set and audited; a school
// already linked elsewhere is refused; and a director or DSL cannot reach it.

const directory = vi.hoisted(() => ({
  configured: true,
  schools: [] as { id: string; name: string }[],
}));

vi.mock("@/server/wonde/directory", () => ({
  isWondeConfigured: () => directory.configured,
  listWondeSchools: async () => directory.schools,
  WondeDirectoryError: class WondeDirectoryError extends Error {},
}));

const run = randomUUID().slice(0, 8);

let trustId: string;
let schoolAId: string;
let schoolBId: string;
let otherSchoolId: string;
let admin: User;
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

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `Wonde Trust ${run}`, slug: `wo-trust-${run}` },
  });
  trustId = trust.id;
  const other = await systemDb.trust.create({
    data: { name: `Wonde Other ${run}`, slug: `wo-other-${run}` },
  });

  const a = await systemDb.tenant.create({
    data: { name: `Downlands ${run}`, slug: `wo-a-${run}`, trustId },
  });
  schoolAId = a.id;
  const b = await systemDb.tenant.create({
    data: { name: `Patcham ${run}`, slug: `wo-b-${run}`, trustId },
  });
  schoolBId = b.id;
  const o = await systemDb.tenant.create({
    data: { name: `Elsewhere ${run}`, slug: `wo-o-${run}`, trustId: other.id },
  });
  otherSchoolId = o.id;

  admin = await systemDb.user.create({
    data: { email: `wo-admin-${run}@t.test`, role: "ADMIN", trustId },
  });
  director = await systemDb.user.create({
    data: { email: `wo-director-${run}@t.test`, role: "DIRECTOR", trustId },
  });
  dsl = await systemDb.user.create({
    data: { email: `wo-dsl-${run}@a.test`, role: "DSL", tenantId: schoolAId },
  });
});

beforeEach(() => {
  directory.configured = true;
  directory.schools = [
    { id: `WS-A-${run}`, name: "Wonde Downlands" },
    { id: `WS-B-${run}`, name: "Wonde Patcham" },
    { id: `WS-C-${run}`, name: "Wonde Coastdown" },
  ];
});

afterAll(async () => {
  const ids = [schoolAId, schoolBId, otherSchoolId];
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({
    where: { slug: { in: [`wo-trust-${run}`, `wo-other-${run}`] } },
  });
});

describe("wonde.overview / availableSchools", () => {
  it("is denied to a director and a DSL", async () => {
    for (const u of [director, dsl]) {
      const caller = createCaller(await contextFor(u));
      await expect(caller.wonde.overview()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });

  it("reports token state and the trust's schools", async () => {
    const caller = createCaller(await contextFor(admin));
    const overview = await caller.wonde.overview();
    expect(overview.configured).toBe(true);
    const ids = overview.schools.map((s) => s.tenantId);
    expect(ids).toContain(schoolAId);
    expect(ids).toContain(schoolBId);
    expect(ids).not.toContain(otherSchoolId);
  });

  it("returns nothing to link when no token is configured", async () => {
    directory.configured = false;
    const caller = createCaller(await contextFor(admin));
    const available = await caller.wonde.availableSchools();
    expect(available).toEqual({ configured: false, schools: [] });
  });
});

describe("wonde.link / unlink", () => {
  it("links a school, records the name and audits it", async () => {
    const caller = createCaller(await contextFor(admin));
    const result = await caller.wonde.link({
      tenantId: schoolAId,
      wondeSchoolId: `WS-A-${run}`,
    });
    expect(result.wondeSchoolName).toBe("Wonde Downlands");

    const tenant = await systemDb.tenant.findUnique({ where: { id: schoolAId } });
    expect(tenant?.wondeSchoolId).toBe(`WS-A-${run}`);
    expect(tenant?.wondeSchoolName).toBe("Wonde Downlands");
    expect(tenant?.wondeConnectedAt).not.toBeNull();

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "wonde.linked", entityId: schoolAId },
    });
    expect(audits.length).toBeGreaterThan(0);

    // Now excluded from the available list.
    const available = await caller.wonde.availableSchools();
    expect(available.schools.map((s) => s.id)).not.toContain(`WS-A-${run}`);
  });

  it("rejects a school the token cannot reach", async () => {
    const caller = createCaller(await contextFor(admin));
    await expect(
      caller.wonde.link({ tenantId: schoolBId, wondeSchoolId: `WS-NOPE-${run}` }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects a Wonde school already linked to another school", async () => {
    const caller = createCaller(await contextFor(admin));
    // WS-A is already linked to schoolA (previous test).
    await expect(
      caller.wonde.link({ tenantId: schoolBId, wondeSchoolId: `WS-A-${run}` }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("cannot link a school outside the admin's trust", async () => {
    const caller = createCaller(await contextFor(admin));
    await expect(
      caller.wonde.link({
        tenantId: otherSchoolId,
        wondeSchoolId: `WS-B-${run}`,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("unlinks a school and audits it", async () => {
    const caller = createCaller(await contextFor(admin));
    await caller.wonde.unlink({ tenantId: schoolAId });

    const tenant = await systemDb.tenant.findUnique({ where: { id: schoolAId } });
    expect(tenant?.wondeSchoolId).toBeNull();
    expect(tenant?.wondeConnectedAt).toBeNull();

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "wonde.unlinked", entityId: schoolAId },
    });
    expect(audits.length).toBeGreaterThan(0);
  });
});
