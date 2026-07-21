import { systemDb } from "@sentinel/db";

import { requireWondeApiKey, syncEnv } from "./env";
import { createRedisConnection, createSyncWorker } from "./queue";
import { HttpWondeTransport, WondeClient } from "./wonde/client";

// Long-running sync worker process: pnpm worker (from the repo root).
// Requires Redis (docker compose up) and WONDE_API_KEY in .env.

const connection = createRedisConnection();
const worker = createSyncWorker(
  connection,
  () =>
    new WondeClient(
      new HttpWondeTransport(requireWondeApiKey(), syncEnv().WONDE_BASE_URL),
    ),
);

worker.on("completed", (job, stats) => {
  console.info(`[sync] ${job.name} for tenant ${job.data.tenantId} done`, stats);
});
worker.on("failed", (job, error) => {
  console.error(`[sync] ${job?.name ?? "?"} failed: ${error.message}`);
});

console.info("[sync] worker started, waiting for jobs");

async function shutdown() {
  console.info("[sync] shutting down");
  await worker.close();
  connection.disconnect();
  await systemDb.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
