import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { systemDb, type Tenant } from "@sentinel/db";

import { createRedisConnection } from "../src/queue";
import {
  createRulesQueue,
  createRulesWorker,
  enqueueRulesRun,
  registerNightlyRulesRun,
} from "../src/rules-queue";

// Scheduled rules runs against real Redis and Postgres: enqueue → worker
// runs the engine → an execution row records the outcome. The engine is
// exercised on an empty school — determinism and signal behaviour have
// their own tests in @sentinel/rules.

const run = randomUUID().slice(0, 8);

let tenant: Tenant;

beforeAll(async () => {
  tenant = await systemDb.tenant.create({
    data: { name: `Rules Queue Test ${run}`, slug: `rules-queue-${run}` },
  });
});

afterAll(async () => {
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.tenant.delete({ where: { id: tenant.id } });
});

async function waitForExecution(tenantId: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const execution = await systemDb.ruleExecution.findFirst({
      where: { tenantId },
      orderBy: { startedAt: "desc" },
    });
    if (execution && execution.status !== "RUNNING") return execution;
    if (Date.now() > deadline) {
      throw new Error("rules execution did not finish in time");
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe("rules queue", () => {
  it("debounces repeat enqueues for the same school into one job", async () => {
    const connection = createRedisConnection();
    const queue = createRulesQueue(connection);
    try {
      // Three sync completions in quick succession → one pending run.
      await enqueueRulesRun(queue, tenant.id, 60_000);
      await enqueueRulesRun(queue, tenant.id, 60_000);
      await enqueueRulesRun(queue, tenant.id, 60_000);

      const delayed = await queue.getDelayed();
      const forTenant = delayed.filter((j) => j.data.tenantId === tenant.id);
      expect(forTenant).toHaveLength(1);

      await forTenant[0]?.remove();
    } finally {
      await queue.close();
      connection.disconnect();
    }
  }, 30_000);

  it("processes an enqueued run through the worker and logs the execution", async () => {
    const queueConnection = createRedisConnection();
    const workerConnection = createRedisConnection();
    const queue = createRulesQueue(queueConnection);
    const worker = createRulesWorker(workerConnection, queue);
    try {
      await enqueueRulesRun(queue, tenant.id, 0);
      const execution = await waitForExecution(tenant.id);

      expect(execution.status).toBe("SUCCEEDED");
      // Every registered rule reports stats, even on an empty school.
      const stats = execution.stats as Record<string, { fired: number }>;
      expect(Object.keys(stats).length).toBeGreaterThanOrEqual(5);
      for (const ruleStats of Object.values(stats)) {
        expect(ruleStats.fired).toBe(0);
      }
    } finally {
      await worker.close();
      await queue.close();
      queueConnection.disconnect();
      workerConnection.disconnect();
    }
  }, 30_000);

  it("registers a single nightly scheduler, idempotently", async () => {
    const connection = createRedisConnection();
    const queue = createRulesQueue(connection);
    try {
      await registerNightlyRulesRun(queue);
      await registerNightlyRulesRun(queue);

      const schedulers = await queue.getJobSchedulers();
      const nightly = schedulers.filter((s) => s.key === "rules-nightly");
      expect(nightly).toHaveLength(1);
      expect(nightly[0]?.pattern).toBe("0 2 * * *");
      expect(nightly[0]?.tz).toBe("UTC");

      await queue.removeJobScheduler("rules-nightly");
    } finally {
      await queue.close();
      connection.disconnect();
    }
  }, 30_000);
});
