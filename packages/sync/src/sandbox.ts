import { systemDb } from "@sentinel/db";
import { runRulesForTenant } from "@sentinel/rules";

import {
  syncAttainment,
  syncAttendance,
  syncBehaviour,
  syncStudents,
  type SyncStats,
} from "./jobs/sync-jobs";
import {
  WondeApiError,
  domainUnavailableFrom,
  type WondeClient,
  type WondeWindow,
} from "./wonde/client";

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
  // Data domains skipped because this school's MIS does not expose them: the
  // Wonde app is not granted the scope (403), e.g.
  // "attendance (Scope attendance.read not enabled)", or the resource does not
  // exist (404), e.g. "attainment (Resource not found)". The connect still
  // succeeds with the domains that ARE available.
  skippedDomains: string[];
};

const ZERO_STATS: SyncStats = { created: 0, updated: 0, skipped: 0 };

// Run one data-domain sync, tolerating a domain this school's MIS does not
// expose: if its scope is not granted (403) or its resource does not exist
// (404), record it as skipped and carry on, rather than failing the whole
// connect. Any other error still propagates.
async function optionalDomain(
  label: string,
  run: () => Promise<SyncStats>,
  skipped: string[],
): Promise<SyncStats> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof WondeApiError) {
      const reason = domainUnavailableFrom(error);
      if (reason) {
        skipped.push(`${label} (${reason})`);
        return ZERO_STATS;
      }
    }
    throw error;
  }
}

// Defaults for the first-pull window on the event-data collections. A full
// school's entire attendance history is hundreds of thousands of rows and takes
// far too long to pull in one go — and the rules engine only looks at recent
// windows — so bound the first pull to recently-updated records and cap the
// pages. Ongoing/nightly sync then advances from there.
const DEFAULT_RECENT_DAYS = 400;
const DEFAULT_MAX_PAGES = 60;

export async function syncSandboxSchool(
  client: WondeClient,
  opts: {
    trustSlug: string;
    schoolSlug: string;
    schoolName: string;
    wondeSchoolId: string;
    // First-pull window overrides (event data only). recentDays 0 = no date
    // filter; maxPages 0 = no page cap (pull everything — slow on a full roll).
    recentDays?: number;
    maxPages?: number;
  },
): Promise<SandboxReport> {
  const recentDays = opts.recentDays ?? DEFAULT_RECENT_DAYS;
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const window: WondeWindow = {
    updatedAfter:
      recentDays > 0
        ? new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    maxPages: maxPages > 0 ? maxPages : undefined,
  };

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

  // Students first: the other jobs resolve pupils by wonde_id. Each data domain
  // is best-effort against the token's granted scopes — a school with only a
  // roll is still a connected school; attendance/behaviour/attainment fill in
  // the risk picture as their scopes are enabled.
  const skippedDomains: string[] = [];
  const students = await optionalDomain(
    "students",
    () => syncStudents(client, tenant),
    skippedDomains,
  );
  const attendance = await optionalDomain(
    "attendance",
    () => syncAttendance(client, tenant, window),
    skippedDomains,
  );
  const behaviour = await optionalDomain(
    "behaviour",
    () => syncBehaviour(client, tenant, window),
    skippedDomains,
  );
  const attainment = await optionalDomain(
    "attainment",
    () => syncAttainment(client, tenant, window),
    skippedDomains,
  );

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
    skippedDomains,
  };
}
