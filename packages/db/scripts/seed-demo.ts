import { runRulesForTenant } from "../../rules/src/index";
import { seedDatabase } from "../prisma/seed";
import { dbForTenant, systemDb } from "../src";

// Decisions a DSL has already worked through, so the overviews show a live
// caseload rather than a wall of untouched flags: some confirmed, some
// escalated, some dismissed, most still awaiting a decision. Deterministic
// (selection by position, not randomness) and idempotent (only OPEN signals
// are decided, so a re-run is a no-op). The hero cases are never decided —
// they carry the demo walk-through and must stay open.
const DISMISS_NOTES = [
  "Discussed with tutor; short-term dip explained by a known family event. Monitoring continues.",
  "Spoke with the family; a temporary change at home. No safeguarding concern at this stage.",
  "Pastoral check-in completed; pupil settled and re-engaged. Closing with a note to review next half term.",
];

async function seedDecisions(schoolId: string) {
  const db = dbForTenant(schoolId);
  const dsl = await db.user.findFirst({
    where: { role: "DSL" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!dsl) return { confirmed: 0, escalated: 0, dismissed: 0 };

  // Open signals a DSL would have triaged, lowest priority first (a DSL clears
  // the monitor-level noise and actions the serious cases). Hero cases excluded.
  const open = await db.signal.findMany({
    where: { status: "OPEN", ruleVersion: { key: { not: "demo-hero" } } },
    orderBy: [{ severity: "asc" }, { createdAt: "asc" }],
    select: { id: true, pupilId: true },
  });

  let confirmed = 0;
  let escalated = 0;
  let dismissed = 0;
  for (let i = 0; i < open.length; i++) {
    const bucket = i % 10;
    let kind: "CONFIRM" | "ESCALATE" | "DISMISS" | null = null;
    if (bucket < 3) kind = "DISMISS";
    else if (bucket < 5) kind = "CONFIRM";
    else if (bucket < 6) kind = "ESCALATE";
    if (!kind) continue; // buckets 6-9 stay open, awaiting a decision

    const signal = open[i]!;
    const status =
      kind === "CONFIRM"
        ? "CONFIRMED"
        : kind === "ESCALATE"
          ? "ESCALATED"
          : "DISMISSED";
    const note = kind === "DISMISS" ? DISMISS_NOTES[i % DISMISS_NOTES.length]! : null;

    await systemDb.signal.update({
      where: { id: signal.id },
      data: { status },
    });
    await systemDb.signalDecision.create({
      data: {
        tenantId: schoolId,
        signalId: signal.id,
        pupilId: signal.pupilId,
        userId: dsl.id,
        kind,
        note,
      },
    });
    await systemDb.auditEvent.create({
      data: {
        tenantId: schoolId,
        userId: dsl.id,
        action: "signal.decided",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
        metadata: { kind, seeded: true },
      },
    });
    if (kind === "CONFIRM") confirmed++;
    else if (kind === "ESCALATE") escalated++;
    else dismissed++;
  }
  return { confirmed, escalated, dismissed };
}

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

  // Only the synthetic demo schools get the rules engine and seeded decisions.
  // A Wonde-connected school (wondeSchoolId set) is a real live roll — the demo
  // seed must never invent signals or decisions on it, or a reset would pollute
  // the live connection with synthetic safeguarding flags.
  const schools = await systemDb.tenant.findMany({
    where: { trustId: { not: null }, wondeSchoolId: null },
    orderBy: { name: "asc" },
  });

  const asOf = new Date();
  for (const school of schools) {
    await runRulesForTenant(school.id, asOf);
    const decided = await seedDecisions(school.id);
    const open = await dbForTenant(school.id).signal.count({
      where: { status: "OPEN" },
    });
    console.info(
      `  ${school.name}: ${open} awaiting, ` +
        `${decided.confirmed} confirmed, ${decided.escalated} escalated, ` +
        `${decided.dismissed} dismissed`,
    );
  }

  const totalSignals = await systemDb.signal.count({ where: { status: "OPEN" } });
  console.info(`\nDone. ${schools.length} schools, ${totalSignals} awaiting a decision.`);
  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await systemDb.$disconnect();
  process.exit(1);
});
