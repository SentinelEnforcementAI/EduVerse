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
import { consumeMagicLink } from "@/server/auth/magic-link";
import { generateToken, hashToken } from "@/server/auth/tokens";

// Trust-admin user management against the real database: an admin lists, invites,
// re-roles and deactivates only their own trust's accounts; every change is
// audited; deactivation revokes sessions and blocks sign-in; and a director or
// DSL cannot reach the surface at all.

const run = randomUUID().slice(0, 8);

let trustId: string;
let schoolAId: string;
let otherTrustId: string;
let otherSchoolId: string;
let admin: User;
let director: User;
let dsl: User;
let otherDsl: User;

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
    data: { name: `Admin Trust ${run}`, slug: `ad-trust-${run}` },
  });
  trustId = trust.id;
  const other = await systemDb.trust.create({
    data: { name: `Other Trust ${run}`, slug: `ad-other-${run}` },
  });
  otherTrustId = other.id;

  const schoolA = await systemDb.tenant.create({
    data: { name: `Downlands ${run}`, slug: `ad-a-${run}`, trustId },
  });
  schoolAId = schoolA.id;
  const otherSchool = await systemDb.tenant.create({
    data: { name: `Elsewhere ${run}`, slug: `ad-o-${run}`, trustId: otherTrustId },
  });
  otherSchoolId = otherSchool.id;

  admin = await systemDb.user.create({
    data: {
      email: `ad-admin-${run}@t.test`,
      name: "Trust Admin",
      role: "ADMIN",
      trustId,
    },
  });
  director = await systemDb.user.create({
    data: {
      email: `ad-director-${run}@t.test`,
      name: "Trust Director",
      role: "DIRECTOR",
      trustId,
    },
  });
  dsl = await systemDb.user.create({
    data: {
      email: `ad-dsl-${run}@a.test`,
      name: "School DSL",
      role: "DSL",
      tenantId: schoolAId,
    },
  });
  otherDsl = await systemDb.user.create({
    data: {
      email: `ad-other-dsl-${run}@o.test`,
      role: "DSL",
      tenantId: otherSchoolId,
    },
  });
});

afterAll(async () => {
  const tenantIds = [schoolAId, otherSchoolId];
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await systemDb.magicLinkToken.deleteMany({
    where: { user: { email: { contains: run } } },
  });
  await systemDb.session.deleteMany({
    where: { user: { email: { contains: run } } },
  });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await systemDb.trust.deleteMany({
    where: { slug: { in: [`ad-trust-${run}`, `ad-other-${run}`] } },
  });
});

describe("admin.users", () => {
  it("lists only the admin's own trust accounts", async () => {
    const caller = createCaller(await contextFor(admin));
    const { users, schools } = await caller.admin.users();
    const emails = users.map((u) => u.email);
    expect(emails).toContain(admin.email);
    expect(emails).toContain(director.email);
    expect(emails).toContain(dsl.email);
    expect(emails).not.toContain(otherDsl.email);
    expect(schools.some((s) => s.id === schoolAId)).toBe(true);
  });

  it("is denied to a director and a DSL", async () => {
    for (const u of [director, dsl]) {
      const caller = createCaller(await contextFor(u));
      await expect(caller.admin.users()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });
});

describe("admin.invite", () => {
  it("provisions a DSL for a school and audits it", async () => {
    const caller = createCaller(await contextFor(admin));
    const email = `ad-new-dsl-${run}@a.test`;
    await caller.admin.invite({ email, role: "DSL", schoolId: schoolAId });
    const created = await systemDb.user.findUnique({ where: { email } });
    expect(created?.role).toBe("DSL");
    expect(created?.tenantId).toBe(schoolAId);
    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "user.provisioned", entityId: created!.id },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("rejects a DSL invite with no school, and a duplicate email", async () => {
    const caller = createCaller(await contextFor(admin));
    await expect(
      caller.admin.invite({ email: `x-${run}@a.test`, role: "DSL" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.admin.invite({ email: dsl.email, role: "DIRECTOR" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("admin.setRole", () => {
  it("promotes a DSL to director, moving scope to the trust", async () => {
    const caller = createCaller(await contextFor(admin));
    await caller.admin.setRole({ userId: dsl.id, role: "DIRECTOR" });
    const updated = await systemDb.user.findUnique({ where: { id: dsl.id } });
    expect(updated?.role).toBe("DIRECTOR");
    expect(updated?.trustId).toBe(trustId);
    expect(updated?.tenantId).toBeNull();
  });

  it("blocks changing your own role", async () => {
    const caller = createCaller(await contextFor(admin));
    await expect(
      caller.admin.setRole({ userId: admin.id, role: "DIRECTOR" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("admin.setStatus", () => {
  it("deactivates an account, revokes its sessions, and blocks sign-in", async () => {
    // Give the director a live session and a fresh magic link first.
    const sessionToken = generateToken();
    await systemDb.session.create({
      data: {
        tokenHash: hashToken(sessionToken),
        userId: director.id,
        tenantId: null,
        expiresAt: new Date(Date.now() + 7 * 864e5),
      },
    });
    const linkToken = generateToken();
    await systemDb.magicLinkToken.create({
      data: {
        tokenHash: hashToken(linkToken),
        userId: director.id,
        tenantId: null,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const caller = createCaller(await contextFor(admin));
    await caller.admin.setStatus({ userId: director.id, status: "DEACTIVATED" });

    const updated = await systemDb.user.findUnique({ where: { id: director.id } });
    expect(updated?.status).toBe("DEACTIVATED");
    expect(updated?.deactivatedAt).not.toBeNull();

    const sessions = await systemDb.session.findMany({
      where: { userId: director.id },
    });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);

    // A magic link issued before deactivation must not grant a session.
    const result = await consumeMagicLink(systemDb, linkToken);
    expect(result.ok).toBe(false);
  });

  it("blocks deactivating your own account", async () => {
    const caller = createCaller(await contextFor(admin));
    await expect(
      caller.admin.setStatus({ userId: admin.id, status: "DEACTIVATED" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cannot touch an account in another trust", async () => {
    const caller = createCaller(await contextFor(admin));
    await expect(
      caller.admin.setStatus({ userId: otherDsl.id, status: "DEACTIVATED" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
