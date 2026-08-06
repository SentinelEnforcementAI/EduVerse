import { systemDb } from "../src";

// One-off, idempotent demo tidy-ups run as an ECS task against the live DB:
//
//   1. Rename the demo leadership account to a credible persona (Sarah Lewis).
//   2. Detach the Wonde sandbox tenant from the demo trust, so it stops
//      appearing on product screens (school lists, switcher, insights, …). The
//      tenant, its roll and its Wonde link are KEPT — only the trust link is
//      cleared, which is fully reversible (re-set trustId to re-attach).
//
// Nothing is hard-deleted. Safe to run more than once.
//
//   pnpm --filter @sentinel/db db:demo:fixups:prod

const DEMO_ADMIN_EMAIL = "tom.abbey32@gmail.com";
const NEW_NAME = "Sarah Lewis";

async function renameLeadershipAccount() {
  // Target the known demo account by email, plus any account still literally
  // named "Founder" (the placeholder the demo was showing).
  const byEmail = await systemDb.user.updateMany({
    where: { email: DEMO_ADMIN_EMAIL },
    data: { name: NEW_NAME },
  });
  const byName = await systemDb.user.updateMany({
    where: { name: "Founder" },
    data: { name: NEW_NAME },
  });
  console.info(
    `Renamed leadership account → ${NEW_NAME} (by email: ${byEmail.count}, by placeholder name: ${byName.count}).`,
  );
}

async function detachSandboxTenant() {
  const sandboxes = await systemDb.tenant.findMany({
    where: {
      OR: [{ slug: "wonde-sandbox" }, { name: { contains: "Sandbox" } }],
    },
    select: { id: true, name: true, slug: true, trustId: true },
  });
  if (sandboxes.length === 0) {
    console.info("No Wonde sandbox tenant found — nothing to detach.");
    return;
  }
  for (const s of sandboxes) {
    console.info(
      `Sandbox tenant: ${s.name} (${s.slug}) — trustId was ${s.trustId ?? "null"}.`,
    );
    if (s.trustId !== null) {
      await systemDb.tenant.update({
        where: { id: s.id },
        data: { trustId: null },
      });
      console.info(`  → detached from trust (data and Wonde link kept).`);
    } else {
      console.info(`  → already detached, left as-is.`);
    }
  }
}

async function main() {
  await renameLeadershipAccount();
  await detachSandboxTenant();
  await systemDb.$disconnect();
  console.info("Demo fix-ups complete.");
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await systemDb.$disconnect();
  process.exit(1);
});
