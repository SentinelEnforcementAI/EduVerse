import { systemDb } from "@sentinel/db";
import { runRulesForTenant } from "@sentinel/rules";

import {
  syncAttainment,
  syncAttendance,
  syncBehaviour,
  syncStudents,
  type SyncStats,
} from "./jobs/sync-jobs";
import type { WondeClient } from "./wonde/client";

// Connect a Wonde school into a trust as a live, engine-analysed school, in one
// synchronous pass (no queue/worker needed — for the sandbox and for ops).
//
// It links a tenant to the Wonde school, pulls students then attendance /
// behaviour / attainment (students first: the other jobs resolve pupils by
// wonde_id), and runs the rules engine so the school appears with a real roll
// and whatever signals its data supports. Strictly read-from-source: nothing is
// ever written back to the MIS (overlay principle). All idempotent — re-running
// converges instead of duplicating.

export type SandboxReport = {
  tenantId: string;
  schoolSlug: string;
  wondeSchoolId: string;
  students: SyncStats;
  attendance: SyncStats;
  behaviour: SyncStats;
  attainment: SyncStats;
  rulesStatus: string;
  openSignals: number;
};

export async function syncSandboxSchool(
  client: WondeClient,
  opts: {
    trustSlug: string;
    schoolSlug: string;
    schoolName: string;
    wondeSchoolId: string;
  },
): Promise<SandboxReport> {
  const trust = await systemDb.trust.findUnique({
    where: { slug: opts.trustSlug },
  });
  if (!trust) {
    throw new Error(
      `No trust with slug "${opts.trustSlug}". Seed the demo trust first.`,
    );
  }

  // Link (or create) the tenant to the Wonde school. Idempotent on slug.
  const tenant = await systemDb.tenant.upsert({
    where: { slug: opts.schoolSlug },
    update: {
      name: opts.schoolName,
      trustId: trust.id,
      wondeSchoolId: opts.wondeSchoolId,
      wondeConnectedAt: new Date(),
    },
    create: {
      name: opts.schoolName,
      slug: opts.schoolSlug,
      trustId: trust.id,
      wondeSchoolId: opts.wondeSchoolId,
      wondeConnectedAt: new Date(),
    },
  });

  // A DSL account so the school view is usable immediately.
  await systemDb.user.upsert({
    where: { email: `dsl@${opts.schoolSlug}.example` },
    update: { role: "DSL", tenantId: tenant.id, trustId: null },
    create: {
      email: `dsl@${opts.schoolSlug}.example`,
      name: `${opts.schoolName} DSL`,
      role: "DSL",
      tenantId: tenant.id,
    },
  });

  const students = await syncStudents(client, tenant);
  const attendance = await syncAttendance(client, tenant);
  const behaviour = await syncBehaviour(client, tenant);
  const attainment = await syncAttainment(client, tenant);

  const rules = await runRulesForTenant(tenant.id, new Date());
  const openSignals = await systemDb.signal.count({
    where: { tenantId: tenant.id, status: "OPEN" },
  });

  return {
    tenantId: tenant.id,
    schoolSlug: opts.schoolSlug,
    wondeSchoolId: opts.wondeSchoolId,
    students,
    attendance,
    behaviour,
    attainment,
    rulesStatus: rules.status,
    openSignals,
  };
}
