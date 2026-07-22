import { parseArgs } from "node:util";

import { systemDb } from "../src";

// Provisions a DSL account. Sign-in is invite-only — this script (and the
// dev seed) are the only ways an account comes to exist. Every provisioning
// action is written to the school's audit trail.
//
//   pnpm --filter @sentinel/db user:add \
//     --email dsl@school.org.uk --tenant downlands --name "A. Example"
//
// CTO-DECISION: proper admin tooling (in-product user management, roles,
// deactivation). This CLI is the simplest working version.
async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      tenant: { type: "string" },
      name: { type: "string" },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const tenantSlug = values.tenant?.trim();
  if (!email || !email.includes("@") || !tenantSlug) {
    console.error(
      'Usage: pnpm --filter @sentinel/db user:add --email <email> --tenant <slug> [--name "<name>"]',
    );
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
    update: { tenantId: tenant.id, ...(values.name ? { name: values.name } : {}) },
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
