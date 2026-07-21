import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { systemDb, type Tenant } from "@sentinel/db";

import {
  createRedisConnection,
  createSyncQueue,
  createSyncWorker,
  enqueueSync,
} from "../src/queue";
import { WondeClient } from "../src/wonde/client";
import { FakeWondeTransport, fixtureSchool } from "./fake-wonde";

// End-to-end queue roundtrip against real Redis: enqueue → worker picks up →
// SyncRun audit row records the outcome.

const run = randomUUID().slice(0, 8);
const SCHOOL_ID = `Q${run}`;

let tenant: Tenant;

beforeAll(async () => {
  tenant = await systemDb.tenant.create({
    data: {
      name: `Queue Test ${run}`,
      slug: `queue-test-${run}`,
      wondeSchoolId: SCHOOL_ID,
    },
  });
});

afterAll(async () => {
  await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.syncRun.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.tenant.delete({ where: { id: tenant.id } });
});

async function waitForRun(syncRunId: string, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const syncRun = await systemDb.syncRun.findUnique({ where: { id: syncRunId } });
    if (syncRun && syncRun.status !== "QUEUED" && syncRun.status !== "RUNNING") {
      return syncRun;
    }
    if (Date.now() > deadline) throw new Error("sync run did not finish in time");
    await new Promise((r) => setTimeout(r, 200));
  }
}

describe("sync queue", () => {
  it("processes an enqueued students sync through a worker", async () => {
    const queueConnection = createRedisConnection();
    const workerConnection = createRedisConnection();
    const queue = createSyncQueue(queueConnection);
    const worker = createSyncWorker(
      workerConnection,
      () => new WondeClient(new FakeWondeTransport(SCHOOL_ID, fixtureSchool())),
    );

    try {
      const runId = await enqueueSync(queue, {
        tenantId: tenant.id,
        type: "STUDENTS",
      });
      const finished = await waitForRun(runId);

      expect(finished.status).toBe("SUCCEEDED");
      expect(finished.startedAt).not.toBeNull();
      expect(finished.finishedAt).not.toBeNull();
      expect(finished.stats).toMatchObject({ created: 3, updated: 0, skipped: 0 });

      const pupilCount = await systemDb.pupil.count({
        where: { tenantId: tenant.id },
      });
      expect(pupilCount).toBe(3);
    } finally {
      await worker.close();
      await queue.close();
      queueConnection.disconnect();
      workerConnection.disconnect();
    }
  }, 30_000);

  it("records failures on the SyncRun row", async () => {
    const queueConnection = createRedisConnection();
    const workerConnection = createRedisConnection();
    const queue = createSyncQueue(queueConnection);
    const worker = createSyncWorker(workerConnection, () => {
      throw new Error("no Wonde credentials");
    });

    try {
      const runId = await enqueueSync(queue, {
        tenantId: tenant.id,
        type: "ATTENDANCE",
      });
      const finished = await waitForRun(runId);

      expect(finished.status).toBe("FAILED");
      expect(finished.error).toContain("no Wonde credentials");
    } finally {
      await worker.close();
      await queue.close();
      queueConnection.disconnect();
      workerConnection.disconnect();
    }
  }, 30_000);
});
