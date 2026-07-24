import { parseArgs } from "node:util";

import { provisionCustomer, systemDb } from "../src";

// Stands up a customer's data on a freshly-migrated silo stack: their trust,
// their schools, and their first trust administrator. This is the last step of
// the provision-customer workflow (after Terraform, images, migrations and the
// app role), and the CLI equivalent of the guided onboarding an admin then
// completes in-product. Idempotent — safe to re-run.
//
//   pnpm --filter @sentinel/db customer:provision \
//     --trust "Weald Learning Trust" \
//     --admin founder@weald-learning-trust.org.uk --admin-name "A. Founder" \
//     --schools "Downlands, Patcham, Coastdown Academy"
//
// --schools is optional: the admin can add schools during onboarding instead.
async function main() {
  const { values } = parseArgs({
    options: {
      trust: { type: "string" },
      "trust-slug": { type: "string" },
      admin: { type: "string" },
      "admin-name": { type: "string" },
      schools: { type: "string" },
    },
  });

  const trustName = values.trust?.trim();
  const adminEmail = values.admin?.trim().toLowerCase();
  if (!trustName || !adminEmail || !adminEmail.includes("@")) {
    console.error(
      'Usage: customer:provision --trust "<name>" --admin <email> ' +
        '[--admin-name "<name>"] [--trust-slug <slug>] ' +
        '[--schools "<name>, <name>, …"]',
    );
    process.exit(1);
  }

  const schools = (values.schools ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name }));

  const result = await provisionCustomer({
    trust: { name: trustName, slug: values["trust-slug"]?.trim() },
    admin: { email: adminEmail, name: values["admin-name"]?.trim() },
    schools,
  });

  const tag = (created: boolean) => (created ? "created" : "already existed");
  console.info(
    `Trust "${result.trust.name}" (${result.trust.slug}) — ${tag(result.trust.created)}.`,
  );
  for (const s of result.schools) {
    console.info(`  School "${s.name}" (${s.slug}) — ${tag(s.created)}.`);
  }
  console.info(
    `Administrator ${result.admin.email} — ${tag(result.admin.created)}. ` +
      "They can now request a sign-in link and finish onboarding in-product.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => systemDb.$disconnect());
