import { systemDb } from "@sentinel/db";

import { requireWondeApiKey, syncEnv } from "./env";
import { createRedisConnection, createSyncWorker } from "./queue";
import {
  createRulesQueue,
  createRulesWorker,
  enqueueRulesRun,
  registerNightlyRulesRun,
} from "./rules-queue";
import { HttpWondeTransport, WondeClient } from "./wonde/client";

// Long-running worker process: pnpm worker (from the repo root).
// Handles both queues — Wonde syncs and rules runs. Requires Redis
// (docker compose up); WONDE_API_KEY in .env for syncs.

const connection = createRedisConnection();
const rulesQueueConnection = createRedisConnection();
const rulesWorkerConnection = createRedisConnection();

const worker = createSyncWorker(
  connection,
  () =>
    new WondeClient(
      new HttpWondeTransport(requireWondeApiKey(), syncEnv().WONDE_BASE_URL),
    ),
);

const rulesQueue = createRulesQueue(rulesQueueConnection);
const rulesWorker = createRulesWorker(rulesWorkerConnection, rulesQueue);

// Scheduling: a debounced rules run after each successful sync, plus a
// nightly 02:00 UTC sweep so schools stay evaluated on days with no sync.
void registerNightlyRulesRun(rulesQueue);

worker.on("completed", (job, stats) => {
  console.info(`[sync] ${job.name} for tenant ${job.data.tenantId} done`, stats);
  void enqueueRulesRun(rulesQueue, job.data.tenantId).catch((error) => {
    console.error(`[rules] failed to enqueue after sync: ${error}`);
  });
});
worker.on("failed", (job, error) => {
  console.error(`[sync] ${job?.name ?? "?"} failed: ${error.message}`);
});

rulesWorker.on("completed", (job, result) => {
  console.info(
    `[rules] ${job.name} for tenant ${job.data.tenantId ?? "all"} done`,
    result,
  );
});
rulesWorker.on("failed", (job, error) => {
  console.error(`[rules] ${job?.name ?? "?"} failed: ${error.message}`);
});

console.info("[worker] started — sync + rules queues, nightly sweep armed");

async function shutdown() {
  console.info("[worker] shutting down");
  await worker.close();
  await rulesWorker.close();
  await rulesQueue.close();
  connection.disconnect();
  rulesQueueConnection.disconnect();
  rulesWorkerConnection.disconnect();
  await systemDb.$disconnect();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
