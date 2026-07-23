import { parseArgs } from "node:util";

import { systemDb } from "../src";

// Provisions an account. Sign-in is invite-only — this script (and the dev
// seed) are the only ways an account comes to exist. Every provisioning action
// is written to the audit trail.
//
//   # A school DSL (default role):
//   pnpm --filter @sentinel/db user:add \
//     --email dsl@school.org.uk --tenant downlands --name "A. Example"
//
//   # A trust Director of Safeguarding (sees across every school in the trust):
//   pnpm --filter @sentinel/db user:add \
//     --email director@trust.org.uk --role director \
//     --trust weald-learning-trust --name "A. Director"
//
// CTO-DECISION: proper admin tooling (in-product user management, roles,
// deactivation). This CLI is the simplest working version.
async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      tenant: { type: "string" },
      trust: { type: "string" },
      role: { type: "string" },
      name: { type: "string" },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const role = (values.role?.trim().toLowerCase() ?? "dsl") as "dsl" | "director";
  if (!email || !email.includes("@") || (role !== "dsl" && role !== "director")) {
    console.error(
      'Usage: user:add --email <email> [--role dsl|director] ' +
        '[--tenant <school-slug>] [--trust <trust-slug>] [--name "<name>"]',
    );
    process.exit(1);
  }

  if (role === "director") {
    const trustSlug = values.trust?.trim();
    if (!trustSlug) {
      console.error("A director needs --trust <trust-slug>.");
      process.exit(1);
    }
    const trust = await systemDb.trust.findUnique({ where: { slug: trustSlug } });
    if (!trust) {
      console.error(`No trust with slug "${trustSlug}".`);
      process.exit(1);
    }

    const user = await systemDb.user.upsert({
      where: { email },
      update: {
        role: "DIRECTOR",
        trustId: trust.id,
        tenantId: null,
        ...(values.name ? { name: values.name } : {}),
      },
      create: {
        email,
        name: values.name ?? null,
        role: "DIRECTOR",
        trustId: trust.id,
      },
    });

    // The audit log is per-tenant; a trust director has no tenant, so record
    // the provisioning against the trust's first school for traceability.
    const firstSchool = await systemDb.tenant.findFirst({
      where: { trustId: trust.id },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (firstSchool) {
      await systemDb.auditEvent.create({
        data: {
          tenantId: firstSchool.id,
          userId: null,
          action: "user.provisioned",
          entityType: "user",
          entityId: user.id,
          metadata: { email, role: "director", trustSlug, via: "user-add-cli" },
        },
      });
    }

    console.info(
      `Provisioned ${email} as Director of Safeguarding for ${trust.name} ` +
        `(user ${user.id}). They can now request a sign-in link.`,
    );
    return;
  }

  const tenantSlug = values.tenant?.trim();
  if (!tenantSlug) {
    console.error("A DSL needs --tenant <school-slug>.");
    process.exit(1);
  }

  const tenant = await systemDb.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant) {
    console.error(`No tenant with slug "${tenantSlug}".`);
    process.exit(1);
  }

  const user = await systemDb.user.upsert({
    where: { email },
    update: {
      role: "DSL",
      tenantId: tenant.id,
      trustId: null,
      ...(values.name ? { name: values.name } : {}),
    },
    create: { email, name: values.name ?? null, tenantId: tenant.id },
  });

  await systemDb.auditEvent.create({
    data: {
      tenantId: tenant.id,
      userId: null,
      action: "user.provisioned",
      entityType: "user",
      entityId: user.id,
      metadata: { email, tenantSlug, via: "user-add-cli" },
    },
  });

  console.info(
    `Provisioned ${email} for ${tenant.name} (user ${user.id}). ` +
      "They can now request a sign-in link.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => systemDb.$disconnect());
