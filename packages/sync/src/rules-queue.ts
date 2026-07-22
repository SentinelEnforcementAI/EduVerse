import { Queue, Worker, type Job } from "bullmq";
import type IORedis from "ioredis";

import { systemDb } from "@sentinel/db";
import { runRulesForTenant } from "@sentinel/rules";

export const RULES_QUEUE_NAME = "rules-runs";

export type RulesJobPayload = {
  tenantId?: string;
};

export function createRulesQueue(connection: IORedis): Queue<RulesJobPayload> {
  return new Queue<RulesJobPayload>(RULES_QUEUE_NAME, { connection });
}

// Enqueues a rules run for one school. jobId is stable per tenant and the
// job sits behind a short delay, so a burst of sync completions (students,
// attendance, behaviour, attainment landing seconds apart) debounces into a
// single run over the freshest data. The engine is idempotent — open
// signals are refreshed, never duplicated, and actioned signals are never
// touched — so an extra run is always safe.
export async function enqueueRulesRun(
  queue: Queue<RulesJobPayload>,
  tenantId: string,
  debounceMs = 30_000,
): Promise<void> {
  await queue.add(
    "run",
    { tenantId },
    {
      jobId: `rules-${tenantId}`,
      delay: debounceMs,
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  );
}

// Enqueues a rules run for every school. The nightly scheduled job fans out
// through this, so a school still gets a fresh evaluation on days when no
// sync ran.
export async function fanOutRulesRuns(
  queue: Queue<RulesJobPayload>,
  debounceMs = 0,
): Promise<number> {
  const tenants = await systemDb.tenant.findMany({ select: { id: true } });
  for (const tenant of tenants) {
    await enqueueRulesRun(queue, tenant.id, debounceMs);
  }
  return tenants.length;
}

// Registers the nightly fallback: one repeatable job at 02:00 UTC that fans
// out a run per school. Idempotent — upsert keeps a single scheduler.
//
// Scheduling policy (was CTO-DECISION in the rules CLI): runs trigger after
// each successful sync, with this nightly sweep as the fallback. Tuning the
// hour or moving to per-school calendars remains open for the CTO.
export async function registerNightlyRulesRun(
  queue: Queue<RulesJobPayload>,
): Promise<void> {
  await queue.upsertJobScheduler(
    "rules-nightly",
    { pattern: "0 2 * * *", tz: "UTC" },
    { name: "nightly", data: {} },
  );
}

export function createRulesWorker(
  connection: IORedis,
  queue: Queue<RulesJobPayload>,
): Worker<RulesJobPayload> {
  return new Worker<RulesJobPayload>(
    RULES_QUEUE_NAME,
    async (job: Job<RulesJobPayload>) => {
      if (job.name === "nightly") {
        const count = await fanOutRulesRuns(queue);
        return { fannedOut: count };
      }
      if (!job.data.tenantId) {
        throw new Error("rules run job missing tenantId");
      }
      // The engine records its own execution log (rule_executions) with
      // per-rule stats — that is the audit surface for scheduled runs.
      const result = await runRulesForTenant(job.data.tenantId);
      return result.stats;
    },
    { connection, concurrency: 1 },
  );
}
