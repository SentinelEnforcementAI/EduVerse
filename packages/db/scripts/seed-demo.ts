import { runRulesForTenant } from "../../rules/src/index";
import { seedDatabase } from "../prisma/seed";
import { dbForTenant, systemDb } from "../src";

// Full demo seed: synthetic pupils and 12 months of data across the trust's
// schools, the hand-crafted hero cases, and then the rules engine run over
// every school so the overviews, triage and cohort views are populated with
// realistic concern volumes. Synthetic data only.
//
//   DEMO_PUPILS (default 220) and DEMO_MONTHS (default 12) tune the size.

async function main() {
  const pupilsPerSchool = Number(process.env.DEMO_PUPILS ?? 220);
  const months = Number(process.env.DEMO_MONTHS ?? 12);

  console.info(
    `Seeding demo data: ${pupilsPerSchool} pupils/school, ${months} months...`,
  );
  await seedDatabase({ pupilsPerSchool, months, log: () => process.stdout.write(".") });
  process.stdout.write("\n");

  const schools = await systemDb.tenant.findMany({
    where: { trustId: { not: null } },
    orderBy: { name: "asc" },
  });

  const asOf = new Date();
  for (const school of schools) {
    await runRulesForTenant(school.id, asOf);
    const open = await dbForTenant(school.id).signal.count({
      where: { status: "OPEN" },
    });
    console.info(`  ${school.name}: ${open} open signals`);
  }

  const totalSignals = await systemDb.signal.count({ where: { status: "OPEN" } });
  console.info(`\nDone. ${schools.length} schools, ${totalSignals} open signals.`);
  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await systemDb.$disconnect();
  process.exit(1);
});
