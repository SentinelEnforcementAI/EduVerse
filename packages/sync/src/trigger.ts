import { parseArgs } from "node:util";

import { systemDb, type SyncType } from "@sentinel/db";

import { syncEnv } from "./env";
import { createRedisConnection, createSyncQueue, enqueueSync } from "./queue";

// Enqueues sync jobs for a tenant: pnpm sync --tenant downlands --type all
// On first use, links the tenant to the Wonde school in WONDE_SCHOOL_ID.
// Sandbox first — Downlands and Patcham get real Wonde connections only
// after signed DPAs (see the kickoff brief).

const TYPES: SyncType[] = ["STUDENTS", "ATTENDANCE", "BEHAVIOUR", "ATTAINMENT"];

async function main() {
  const { values } = parseArgs({
    options: {
      tenant: { type: "string" },
      type: { type: "string", default: "all" },
    },
  });
  if (!values.tenant) {
    throw new Error("Usage: pnpm sync --tenant <slug> [--type students|attendance|behaviour|attainment|all]");
  }

  const tenant = await systemDb.tenant.findUnique({
    where: { slug: values.tenant },
  });
  if (!tenant) throw new Error(`Unknown tenant slug: ${values.tenant}`);

  if (!tenant.wondeSchoolId) {
    const schoolId = syncEnv().WONDE_SCHOOL_ID;
    if (!schoolId) {
      throw new Error(
        `Tenant ${tenant.slug} is not linked to a Wonde school and ` +
          `WONDE_SCHOOL_ID is not set in .env.`,
      );
    }
    await systemDb.tenant.update({
      where: { id: tenant.id },
      data: { wondeSchoolId: schoolId },
    });
    console.info(`Linked ${tenant.slug} to Wonde school ${schoolId}`);
  }

  const requested =
    values.type === "all"
      ? TYPES
      : TYPES.filter((t) => t.toLowerCase() === values.type!.toLowerCase());
  if (requested.length === 0) {
    throw new Error(`Unknown sync type: ${values.type}`);
  }

  const connection = createRedisConnection();
  const queue = createSyncQueue(connection);
  // Students first: the other jobs resolve pupils by wonde_id.
  for (const type of requested) {
    const runId = await enqueueSync(queue, { tenantId: tenant.id, type });
    console.info(`Enqueued ${type} sync (run ${runId})`);
  }
  await queue.close();
  connection.disconnect();
  await systemDb.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
