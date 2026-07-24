import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@prisma/client";

import { dbForTenant, systemDb } from "../src";

// Proves tenant isolation is enforced by the database, not application code:
// every path below goes through Postgres RLS policies. If a policy is dropped
// or weakened, these tests fail.

const run = randomUUID().slice(0, 8);
const emailA = `dsl-a-${run}@downlands.test`;
const emailB = `dsl-b-${run}@patcham.test`;
const emailPlatform = `platform-${run}@sentinel.test`;

let tenantAId: string;
let tenantBId: string;
let userBId: string;

beforeAll(async () => {
  const tenantA = await systemDb.tenant.create({
    data: { name: "Downlands Test", slug: `downlands-${run}` },
  });
  const tenantB = await systemDb.tenant.create({
    data: { name: "Patcham Test", slug: `patcham-${run}` },
  });
  tenantAId = tenantA.id;
  tenantBId = tenantB.id;

  await systemDb.user.create({
    data: { email: emailA, tenantId: tenantAId },
  });
  const userB = await systemDb.user.create({
    data: { email: emailB, tenantId: tenantBId },
  });
  userBId = userB.id;

  await systemDb.user.create({ data: { email: emailPlatform } });

  await systemDb.session.create({
    data: {
      tokenHash: `rls-test-${run}`,
      userId: userBId,
      tenantId: tenantBId,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
});

afterAll(async () => {
  await systemDb.caseMessage.deleteMany({
    where: { tenantId: { in: [tenantAId, tenantBId] } },
  });
  await systemDb.session.deleteMany({ where: { tokenHash: `rls-test-${run}` } });
  await systemDb.user.deleteMany({
    where: { email: { in: [emailA, emailB, emailPlatform] } },
  });
  await systemDb.tenant.deleteMany({ where: { id: { in: [tenantAId, tenantBId] } } });
});

describe("database role", () => {
  it("cannot bypass RLS (superuser connections would disable isolation silently)", async () => {
    const raw = new PrismaClient();
    try {
      const [role] = await raw.$queryRaw<
        { rolsuper: boolean; rolbypassrls: boolean }[]
      >`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
      expect(role.rolsuper).toBe(false);
      expect(role.rolbypassrls).toBe(false);
    } finally {
      await raw.$disconnect();
    }
  });
});

describe("system context", () => {
  it("sees users across tenants (needed for auth flows)", async () => {
    const users = await systemDb.user.findMany({
      where: { email: { in: [emailA, emailB, emailPlatform] } },
    });
    expect(users).toHaveLength(3);
  });
});

describe("unscoped client (no RLS context)", () => {
  it("is denied everything by default", async () => {
    const raw = new PrismaClient();
    try {
      await expect(raw.user.findMany()).resolves.toHaveLength(0);
      await expect(raw.tenant.findMany()).resolves.toHaveLength(0);
      await expect(
        raw.user.create({ data: { email: `raw-${run}@test.test` } }),
      ).rejects.toThrow();
    } finally {
      await raw.$disconnect();
    }
  });
});

describe("tenant-scoped reads", () => {
  it("tenant A sees only its own users", async () => {
    const users = await dbForTenant(tenantAId).user.findMany();
    expect(users.map((u) => u.email)).toEqual([emailA]);
  });

  it("tenant A cannot look up a tenant B user, even by exact email", async () => {
    const user = await dbForTenant(tenantAId).user.findUnique({
      where: { email: emailB },
    });
    expect(user).toBeNull();
  });

  it("platform users (null tenant_id) are invisible to tenant contexts", async () => {
    const user = await dbForTenant(tenantAId).user.findUnique({
      where: { email: emailPlatform },
    });
    expect(user).toBeNull();
  });

  it("tenant A sees only its own tenant row", async () => {
    const tenants = await dbForTenant(tenantAId).tenant.findMany();
    expect(tenants.map((t) => t.id)).toEqual([tenantAId]);
  });

  it("tenant A cannot see tenant B's sessions", async () => {
    expect(await dbForTenant(tenantAId).session.findMany()).toHaveLength(0);
    expect(await dbForTenant(tenantBId).session.findMany()).toHaveLength(1);
  });
});

describe("tenant-scoped writes", () => {
  it("tenant A cannot insert rows into tenant B", async () => {
    await expect(
      dbForTenant(tenantAId).user.create({
        data: { email: `intruder-${run}@test.test`, tenantId: tenantBId },
      }),
    ).rejects.toThrow();
  });

  it("tenant A cannot update tenant B rows (0 rows matched)", async () => {
    const result = await dbForTenant(tenantAId).user.updateMany({
      where: { id: userBId },
      data: { name: "hacked" },
    });
    expect(result.count).toBe(0);

    const untouched = await systemDb.user.findUnique({ where: { id: userBId } });
    expect(untouched?.name).toBeNull();
  });

  it("tenant A cannot delete tenant B rows (0 rows matched)", async () => {
    const result = await dbForTenant(tenantAId).user.deleteMany({
      where: { id: userBId },
    });
    expect(result.count).toBe(0);
  });

  it("tenant contexts cannot create or modify tenants", async () => {
    await expect(
      dbForTenant(tenantAId).tenant.create({
        data: { name: "Rogue School", slug: `rogue-${run}` },
      }),
    ).rejects.toThrow();

    // The tenant's own row is readable (passes USING) but not writable:
    // WITH CHECK rejects the modified row outright.
    await expect(
      dbForTenant(tenantAId).tenant.updateMany({
        where: { id: tenantAId },
        data: { name: "Renamed" },
      }),
    ).rejects.toThrow();

    const untouched = await systemDb.tenant.findUnique({
      where: { id: tenantAId },
    });
    expect(untouched?.name).toBe("Downlands Test");
  });

  it("tenant A can write within its own tenant", async () => {
    const created = await dbForTenant(tenantAId).user.create({
      data: { email: `second-a-${run}@downlands.test`, tenantId: tenantAId },
    });
    expect(created.tenantId).toBe(tenantAId);
    await dbForTenant(tenantAId).user.delete({ where: { id: created.id } });
  });
});

// Case communications (slice 4: email mission control) are an append-only,
// tenant-isolated safeguarding record — the same guarantees as case notes and
// decisions, proven at the database.
describe("case_messages RLS (append-only, tenant-isolated)", () => {
  async function seedMessage(tenantId: string, subject: string) {
    return dbForTenant(tenantId).caseMessage.create({
      data: {
        tenantId,
        signalId: `sig-${run}`,
        pupilId: `pup-${run}`,
        direction: "OUTBOUND",
        fromAddress: "safeguarding@school.test",
        toAddresses: ["mash@la.test"],
        subject,
        body: "Referral body.",
        sentById: null,
      },
    });
  }

  it("a tenant sees only its own case messages", async () => {
    await seedMessage(tenantAId, `A-${run}`);
    await seedMessage(tenantBId, `B-${run}`);

    const aSeen = await dbForTenant(tenantAId).caseMessage.findMany();
    expect(aSeen.map((m) => m.subject)).toEqual([`A-${run}`]);
    const bSeen = await dbForTenant(tenantBId).caseMessage.findMany();
    expect(bSeen.map((m) => m.subject)).toEqual([`B-${run}`]);
  });

  it("cannot be inserted into another tenant", async () => {
    await expect(
      dbForTenant(tenantAId).caseMessage.create({
        data: {
          tenantId: tenantBId,
          signalId: `sig-${run}`,
          pupilId: `pup-${run}`,
          direction: "OUTBOUND",
          fromAddress: "x@school.test",
          toAddresses: ["y@la.test"],
          subject: "intruder",
          body: "x",
        },
      }),
    ).rejects.toThrow();
  });

  it("is append-only: no UPDATE or DELETE policy, so neither matches a row", async () => {
    // FORCE RLS with no UPDATE/DELETE policy denies the row set entirely →
    // zero rows affected, and the record stands unchanged.
    const updated = await dbForTenant(tenantAId).caseMessage.updateMany({
      where: { subject: `A-${run}` },
      data: { subject: "rewritten" },
    });
    expect(updated.count).toBe(0);
    const deleted = await dbForTenant(tenantAId).caseMessage.deleteMany({
      where: { subject: `A-${run}` },
    });
    expect(deleted.count).toBe(0);

    const still = await dbForTenant(tenantAId).caseMessage.findMany();
    expect(still.map((m) => m.subject)).toEqual([`A-${run}`]);
  });
});
