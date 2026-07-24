import { systemDb } from "./index";

// Customer provisioning — the data-layer half of the silo "environment factory"
// (commercialisation slice 2). The infrastructure half (a per-MAT AWS stack:
// VPC, RDS, Redis, ECS, subdomain) is stood up by the provision-customer
// workflow; once that stack's database is migrated, this is what seeds the
// customer's trust, schools and first administrator. One named, idempotent,
// audited action — replacing the ad-hoc seed + user:add dance.
//
// Runtime onboarding (an admin adding a school, inviting a DSL) reuses the same
// primitives, so a school created during onboarding is indistinguishable from
// one created at provisioning time. Everything here runs under the RLS system
// context (systemDb) — provisioning predates any tenant user.

// A URL/DNS-safe slug from a display name. A slug is the stable public key for a
// trust or school (subdomain, CLI selector), so it is derived once and kept.
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "school";
}

// A slug not yet used by any trust or school (both share one global slug space).
// Appends -2, -3 … until free, so two schools that share a name can coexist.
async function uniqueSlug(base: string): Promise<string> {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const [trust, tenant] = await Promise.all([
      systemDb.trust.findUnique({
        where: { slug: candidate },
        select: { id: true },
      }),
      systemDb.tenant.findUnique({
        where: { slug: candidate },
        select: { id: true },
      }),
    ]);
    if (!trust && !tenant) return candidate;
  }
}

// Adds a school (tenant) to a trust and audits it against itself. The single
// primitive for "a new school exists in this trust" — used by provisioning and
// by an admin adding a school during onboarding. A new tenant is just a new
// tenant_id value; the row-level-security policies already cover every table,
// so no per-tenant setup is needed.
export async function createSchool(input: {
  trustId: string;
  name: string;
  slug?: string;
  actingUserId?: string | null;
}): Promise<{ id: string; name: string; slug: string }> {
  const name = input.name.trim();
  if (!name) throw new Error("A school name is required.");
  const slug = input.slug?.trim() || (await uniqueSlug(slugify(name)));

  const tenant = await systemDb.tenant.create({
    data: { name, slug, trustId: input.trustId },
  });
  await systemDb.auditEvent.create({
    data: {
      tenantId: tenant.id,
      userId: input.actingUserId ?? null,
      action: "school.provisioned",
      entityType: "tenant",
      entityId: tenant.id,
      metadata: { name, slug, trustId: input.trustId },
    },
  });
  return { id: tenant.id, name: tenant.name, slug };
}

export type ProvisionSchool = { name: string; slug?: string };

export type ProvisionCustomerInput = {
  trust: { name: string; slug?: string };
  admin: { email: string; name?: string };
  schools?: ProvisionSchool[];
};

export type ProvisionedRef = {
  id: string;
  name: string;
  slug: string;
  created: boolean;
};

export type ProvisionCustomerResult = {
  trust: ProvisionedRef;
  admin: { id: string; email: string; created: boolean };
  schools: ProvisionedRef[];
};

// Stands up a customer's data: their trust, their schools, and their first
// trust administrator. Idempotent — a re-run with the same slugs updates names
// in place and never creates duplicates, so it is safe to re-invoke if a
// provisioning run failed partway. Returns what existed vs what was created.
export async function provisionCustomer(
  input: ProvisionCustomerInput,
): Promise<ProvisionCustomerResult> {
  const email = input.admin.email.trim().toLowerCase();
  if (!email.includes("@")) {
    throw new Error("A valid administrator email is required.");
  }

  const trustName = input.trust.name.trim();
  if (!trustName) throw new Error("A trust name is required.");
  const trustSlug = input.trust.slug?.trim() || slugify(trustName);

  // Trust, upserted by slug: a re-run updates the name, never adds a second.
  const existingTrust = await systemDb.trust.findUnique({
    where: { slug: trustSlug },
  });
  const trust = existingTrust
    ? await systemDb.trust.update({
        where: { id: existingTrust.id },
        data: { name: trustName },
      })
    : await systemDb.trust.create({
        data: { name: trustName, slug: trustSlug },
      });

  // A billing account with default (provisional) pricing, so metering has a
  // basis from day one. Idempotent — a re-run leaves an existing account's
  // negotiated pricing untouched.
  await systemDb.billingAccount.upsert({
    where: { trustId: trust.id },
    update: {},
    create: { trustId: trust.id },
  });

  // Schools, upserted by slug under this trust. A slug already owned by this
  // trust is updated; a brand-new one is created and audited against itself.
  const schools: ProvisionedRef[] = [];
  for (const s of input.schools ?? []) {
    const name = s.name.trim();
    if (!name) continue;
    const slug = s.slug?.trim() || slugify(name);
    const existing = await systemDb.tenant.findUnique({ where: { slug } });
    if (existing) {
      const updated = await systemDb.tenant.update({
        where: { id: existing.id },
        data: { name, trustId: trust.id },
      });
      schools.push({ id: updated.id, name: updated.name, slug, created: false });
    } else {
      const created = await systemDb.tenant.create({
        data: { name, slug, trustId: trust.id },
      });
      await systemDb.auditEvent.create({
        data: {
          tenantId: created.id,
          userId: null,
          action: "school.provisioned",
          entityType: "tenant",
          entityId: created.id,
          metadata: { name, slug, trustId: trust.id, via: "provision-customer" },
        },
      });
      schools.push({ id: created.id, name: created.name, slug, created: true });
    }
  }

  // First administrator, upserted by email: everything a director sees plus
  // user management, so the whole product is reachable from one account.
  const existingAdmin = await systemDb.user.findUnique({ where: { email } });
  const admin = existingAdmin
    ? await systemDb.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: "ADMIN",
          trustId: trust.id,
          tenantId: null,
          status: "ACTIVE",
          deactivatedAt: null,
          ...(input.admin.name ? { name: input.admin.name } : {}),
        },
      })
    : await systemDb.user.create({
        data: {
          email,
          name: input.admin.name ?? null,
          role: "ADMIN",
          trustId: trust.id,
        },
      });

  // The audit log is per-tenant; a trust administrator has no tenant, so record
  // the provisioning against the trust's first school (matching user:add). If
  // the trust has no schools yet, this admin action is not tenant-auditable
  // until one exists — onboarding then audits every school it adds.
  const firstSchool = await systemDb.tenant.findFirst({
    where: { trustId: trust.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (firstSchool && !existingAdmin) {
    await systemDb.auditEvent.create({
      data: {
        tenantId: firstSchool.id,
        userId: null,
        action: "user.provisioned",
        entityType: "user",
        entityId: admin.id,
        metadata: {
          email,
          role: "admin",
          trustSlug,
          via: "provision-customer",
        },
      },
    });
  }

  return {
    trust: {
      id: trust.id,
      name: trust.name,
      slug: trust.slug,
      created: !existingTrust,
    },
    admin: { id: admin.id, email, created: !existingAdmin },
    schools,
  };
}
