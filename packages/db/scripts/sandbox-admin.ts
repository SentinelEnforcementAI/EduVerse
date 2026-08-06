import { systemDb } from "../src";

// Inspect or tidy the Wonde sandbox tenant.
//
//   report → print the tenant's data footprint (roll + event rows + signals by
//            rule and status), to see exactly what it holds.
//   clean  → remove the sandbox tenant's signals, case artefacts, rule runs and
//            event data, KEEPING the pupil roll, users and the tenant itself —
//            so the connected school shows a clean live roll with no engine
//            noise. Never touches any other tenant.
//
//   pnpm --filter @sentinel/db db:sandbox:admin -- --mode report --slug wonde-sandbox
//
// Deletes are ordered children-first so foreign keys are satisfied without
// disabling constraints.

async function resolveTenant(slug: string) {
  const tenant = await systemDb.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, trustId: true, wondeSchoolId: true },
  });
  if (!tenant) throw new Error(`No tenant with slug "${slug}".`);
  return tenant;
}

async function report(tenantId: string) {
  const where = { tenantId };
  const [pupils, attendance, behaviour, attainment, signalsTotal] = await Promise.all([
    systemDb.pupil.count({ where }),
    systemDb.attendanceRecord.count({ where }),
    systemDb.behaviourIncident.count({ where }),
    systemDb.attainmentRecord.count({ where }),
    systemDb.signal.count({ where }),
  ]);

  // Signals by rule key + status (small enough to tally in memory).
  const signals = await systemDb.signal.findMany({
    where,
    select: { status: true, ruleVersion: { select: { key: true } } },
  });
  const byRule: Record<string, Record<string, number>> = {};
  for (const s of signals) {
    const key = s.ruleVersion?.key ?? "unknown";
    byRule[key] = byRule[key] ?? {};
    byRule[key][s.status] = (byRule[key][s.status] ?? 0) + 1;
  }

  return {
    pupils,
    attendanceRecords: attendance,
    behaviourIncidents: behaviour,
    attainmentRecords: attainment,
    signalsTotal,
    signalsByRuleAndStatus: byRule,
  };
}

// The engine output that makes a school look "analysed": signals and the
// event data the rules run over. Deleting these returns the tenant to a clean
// roll with no open concerns. `signal` is deleted before `ruleExecution`
// (signals reference an execution). The pupil roll, users and tenant are kept.
//
// Append-only case history (signal_decisions, case_notes, referrals, audit
// events, …) is deliberately NOT deleted — those tables are hard-delete-proof
// by RLS ("safeguarding records are never hard-deleted"). Once the signals are
// gone, any such rows are orphaned and never surface in the UI, so a clean roll
// is achieved without violating the append-only guarantee.
const CLEAN_ORDER = [
  "signal",
  "ruleExecution",
  "attendanceRecord",
  "behaviourIncident",
  "attainmentRecord",
] as const;

async function clean(tenantId: string) {
  const deleted: Record<string, number> = {};
  for (const model of CLEAN_ORDER) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = (systemDb as any)[model];
    const res = await delegate.deleteMany({ where: { tenantId } });
    deleted[model] = res.count;
  }
  return deleted;
}

// One-off demo tidy-ups (mode "fixups"), idempotent and non-destructive:
//   1. Rename the demo leadership account to a credible persona (Sarah Lewis).
//   2. Detach the Wonde sandbox tenant from the demo trust, so it stops
//      appearing on product screens. The tenant, roll and Wonde link are KEPT —
//      only the trust link is cleared, which is fully reversible.
const DEMO_ADMIN_EMAIL = "tom.abbey32@gmail.com";
const NEW_NAME = "Sarah Lewis";

async function renameLeadershipAccount() {
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

async function detachSandbox(slug: string) {
  const sandboxes = await systemDb.tenant.findMany({
    where: { OR: [{ slug }, { name: { contains: "Sandbox" } }] },
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
      console.info("  → detached from trust (data and Wonde link kept).");
    } else {
      console.info("  → already detached, left as-is.");
    }
  }
}

async function main() {
  const args = new Map<string, string>();
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!;
    if (tok.startsWith("--") && tok.length > 2) {
      const key = tok.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key, next);
        i += 1;
      } else {
        args.set(key, "");
      }
    }
  }
  const mode = args.get("mode") ?? "report";
  const slug = args.get("slug") ?? "wonde-sandbox";

  // Demo tidy-ups run before (and independently of) the tenant footprint report,
  // so the rename still happens even if the sandbox tenant is absent.
  if (mode === "fixups") {
    await renameLeadershipAccount();
    await detachSandbox(slug);
    await systemDb.$disconnect();
    console.info("\nDemo fix-ups complete.");
    return;
  }

  const tenant = await resolveTenant(slug);
  console.info(`Sandbox tenant: ${tenant.name} (${tenant.slug}) id=${tenant.id}`);
  console.info(`  trustId=${tenant.trustId} wondeSchoolId=${tenant.wondeSchoolId}`);

  console.info("\nBefore:");
  console.info(JSON.stringify(await report(tenant.id), null, 2));

  if (mode === "clean") {
    const deleted = await clean(tenant.id);
    console.info("\nDeleted (roll, users and tenant kept):");
    console.info(JSON.stringify(deleted, null, 2));
    console.info("\nAfter:");
    console.info(JSON.stringify(await report(tenant.id), null, 2));
  } else if (mode !== "report") {
    throw new Error(`Unknown mode "${mode}" (use report or clean).`);
  }

  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await systemDb.$disconnect();
  process.exit(1);
});
