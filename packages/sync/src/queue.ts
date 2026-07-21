import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

import { systemDb, type SyncType } from "@sentinel/db";

import { syncEnv } from "./env";
import { runSync, type SyncStats } from "./jobs/sync-jobs";
import type { WondeClient } from "./wonde/client";

export const SYNC_QUEUE_NAME = "wonde-sync";

export type SyncJobPayload = {
  syncRunId: string;
  tenantId: string;
  type: SyncType;
};

export function createRedisConnection(): IORedis {
  // maxRetriesPerRequest: null is required by BullMQ workers.
  return new IORedis(syncEnv().REDIS_URL, { maxRetriesPerRequest: null });
}

export function createSyncQueue(connection: IORedis): Queue<SyncJobPayload> {
  return new Queue<SyncJobPayload>(SYNC_QUEUE_NAME, { connection });
}

// Creates the SyncRun audit row and enqueues the job. jobId = syncRunId makes
// the enqueue itself idempotent: the same run cannot be queued twice.
export async function enqueueSync(
  queue: Queue<SyncJobPayload>,
  input: { tenantId: string; type: SyncType },
): Promise<string> {
  const run = await systemDb.syncRun.create({
    data: { tenantId: input.tenantId, type: input.type },
  });
  await queue.add(
    input.type,
    { syncRunId: run.id, tenantId: input.tenantId, type: input.type },
    { jobId: run.id, removeOnComplete: 100, removeOnFail: 100 },
  );
  return run.id;
}

// CTO-DECISION: retry policy for failed syncs (attempts/backoff, alerting).
// Simplest working version: one attempt, failures recorded on the SyncRun
// row and visible on the dashboard; jobs are idempotent so manual re-runs
// are always safe.
export function createSyncWorker(
  connection: IORedis,
  clientFactory: () => WondeClient,
): Worker<SyncJobPayload> {
  return new Worker<SyncJobPayload>(
    SYNC_QUEUE_NAME,
    async (job: Job<SyncJobPayload>) => {
      const { syncRunId, tenantId, type } = job.data;
      await systemDb.syncRun.update({
        where: { id: syncRunId },
        data: { status: "RUNNING", startedAt: new Date() },
      });
      try {
        const stats: SyncStats = await runSync(clientFactory(), type, tenantId);
        await systemDb.syncRun.update({
          where: { id: syncRunId },
          data: { status: "SUCCEEDED", finishedAt: new Date(), stats },
        });
        return stats;
      } catch (error) {
        await systemDb.syncRun.update({
          where: { id: syncRunId },
          data: {
            status: "FAILED",
            finishedAt: new Date(),
            error: error instanceof Error ? error.message : String(error),
          },
        });
        throw error;
      }
    },
    { connection, concurrency: 1 },
  );
}
