import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  createSchool,
  dbForTenant,
  provisionCustomer,
  slugify,
  systemDb,
} from "../src";

// Customer provisioning against the real database (commercialisation slice 2):
// provisionCustomer stands up a trust, its schools and a first administrator,
// idempotently; createSchool adds a school under a trust and audits it. These
// are the data-layer half of the silo environment factory and the primitives
// the guided onboarding flow reuses.

const run = randomUUID().slice(0, 8);
const slugs = new Set<string>();
const trustSlugs = new Set<string>();

function track(result: {
  trust: { slug: string };
  schools: { slug: string }[];
}) {
  trustSlugs.add(result.trust.slug);
  for (const s of result.schools) slugs.add(s.slug);
}

afterAll(async () => {
  const tenants = await systemDb.tenant.findMany({
    where: { slug: { in: [...slugs] } },
    select: { id: true },
  });
  const tenantIds = tenants.map((t) => t.id);
  await systemDb.auditEvent.deleteMany({
    where: { tenantId: { in: tenantIds } },
  });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { slug: { in: [...slugs] } } });
  await systemDb.trust.deleteMany({ where: { slug: { in: [...trustSlugs] } } });
});

describe("slugify", () => {
  it("makes a DNS-safe slug and never returns empty", () => {
    expect(slugify("Weald Learning Trust")).toBe("weald-learning-trust");
    expect(slugify("  Coastdown Academy!  ")).toBe("coastdown-academy");
    expect(slugify("St. Mary's C-of-E")).toBe("st-mary-s-c-of-e");
    expect(slugify("***")).toBe("school");
  });
});

describe("provisionCustomer", () => {
  it("creates a trust, its schools and a first admin, and reports them created", async () => {
    const result = await provisionCustomer({
      trust: { name: `Weald ${run}` },
      admin: { email: `founder-${run}@weald.test`, name: "A. Founder" },
      schools: [{ name: `Downlands ${run}` }, { name: `Patcham ${run}` }],
    });
    track(result);

    expect(result.trust.created).toBe(true);
    expect(result.trust.slug).toBe(slugify(`Weald ${run}`));
    expect(result.admin.created).toBe(true);
    expect(result.schools.map((s) => s.created)).toEqual([true, true]);

    const admin = await systemDb.user.findUnique({
      where: { email: `founder-${run}@weald.test` },
    });
    expect(admin?.role).toBe("ADMIN");
    expect(admin?.trustId).toBe(result.trust.id);
    expect(admin?.tenantId).toBeNull();

    const schools = await systemDb.tenant.findMany({
      where: { trustId: result.trust.id },
    });
    expect(schools).toHaveLength(2);

    // The first admin is audited against the trust's first school.
    const audits = await systemDb.auditEvent.findMany({
      where: {
        action: "user.provisioned",
        entityId: admin!.id,
      },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0]!.metadata).toMatchObject({ via: "provision-customer" });
  });

  it("is idempotent: a re-run creates nothing and updates names in place", async () => {
    const first = await provisionCustomer({
      trust: { name: `Repeat ${run}` },
      admin: { email: `repeat-${run}@t.test` },
      schools: [{ name: `Repeat School ${run}` }],
    });
    track(first);

    const second = await provisionCustomer({
      trust: { name: `Repeat Renamed ${run}`, slug: first.trust.slug },
      admin: { email: `repeat-${run}@t.test` },
      schools: [{ name: `Repeat School ${run}`, slug: first.schools[0]!.slug }],
    });
    track(second);

    expect(second.trust.id).toBe(first.trust.id);
    expect(second.trust.created).toBe(false);
    expect(second.admin.id).toBe(first.admin.id);
    expect(second.admin.created).toBe(false);
    expect(second.schools[0]!.created).toBe(false);

    const trust = await systemDb.trust.findUnique({
      where: { id: first.trust.id },
    });
    expect(trust?.name).toBe(`Repeat Renamed ${run}`);

    const schoolCount = await systemDb.tenant.count({
      where: { trustId: first.trust.id },
    });
    expect(schoolCount).toBe(1);
  });

  it("re-activates an admin whose account had been deactivated", async () => {
    const created = await provisionCustomer({
      trust: { name: `Reactivate ${run}` },
      admin: { email: `react-${run}@t.test` },
      schools: [{ name: `Reactivate School ${run}` }],
    });
    track(created);

    await systemDb.user.update({
      where: { id: created.admin.id },
      data: { status: "DEACTIVATED", deactivatedAt: new Date() },
    });

    const again = await provisionCustomer({
      trust: { name: `Reactivate ${run}`, slug: created.trust.slug },
      admin: { email: `react-${run}@t.test` },
    });
    track(again);

    const admin = await systemDb.user.findUnique({
      where: { id: created.admin.id },
    });
    expect(admin?.status).toBe("ACTIVE");
    expect(admin?.deactivatedAt).toBeNull();
  });
});

describe("createSchool", () => {
  it("adds a school under a trust and audits it against itself", async () => {
    const provisioned = await provisionCustomer({
      trust: { name: `Grow ${run}` },
      admin: { email: `grow-${run}@t.test` },
    });
    track(provisioned);

    const school = await createSchool({
      trustId: provisioned.trust.id,
      name: `New Wing ${run}`,
      actingUserId: provisioned.admin.id,
    });
    slugs.add(school.slug);

    const tenant = await systemDb.tenant.findUnique({
      where: { id: school.id },
    });
    expect(tenant?.trustId).toBe(provisioned.trust.id);

    const audits = await dbForTenant(school.id).auditEvent.findMany({
      where: { action: "school.provisioned", entityId: school.id },
    });
    expect(audits.length).toBeGreaterThan(0);
    expect(audits[0]!.userId).toBe(provisioned.admin.id);
  });

  it("gives two schools that share a name distinct slugs", async () => {
    const provisioned = await provisionCustomer({
      trust: { name: `Twin ${run}` },
      admin: { email: `twin-${run}@t.test` },
    });
    track(provisioned);

    const a = await createSchool({
      trustId: provisioned.trust.id,
      name: `Sharedname ${run}`,
    });
    const b = await createSchool({
      trustId: provisioned.trust.id,
      name: `Sharedname ${run}`,
    });
    slugs.add(a.slug);
    slugs.add(b.slug);

    expect(a.slug).not.toBe(b.slug);
  });
});
