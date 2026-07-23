import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Inspection readiness aggregates real records into the golden thread.

const run = randomUUID().slice(0, 8);
let schoolId: string;
let dsl: User;

async function ctxFor(user: User): Promise<TRPCContext> {
  const tenancy = await resolveTenancy(user);
  return {
    db: systemDb,
    session: { sessionId: `s-${run}`, user },
    tenantId: user.tenantId,
    tenantDb: user.tenantId ? dbForTenant(user.tenantId) : null,
    tenancy,
    headers: new Headers(),
  };
}

beforeAll(async () => {
  const s = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `ins-${run}` },
  });
  schoolId = s.id;
  dsl = await systemDb.user.create({
    data: { email: `ins-${run}@a.test`, role: "DSL", tenantId: schoolId },
  });
  await systemDb.document.create({
    data: {
      tenantId: schoolId,
      scope: "ORG",
      title: "Child Protection Policy",
      type: "Policy",
      docDate: new Date("2026-01-06"),
      status: "Current",
      themes: ["child protection"],
      summary: "x",
      content: "x",
    },
  });
});

afterAll(async () => {
  await systemDb.document.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.user.deleteMany({ where: { id: dsl.id } });
  await systemDb.tenant.deleteMany({ where: { id: schoolId } });
});

describe("inspection.school", () => {
  it("assembles the golden thread from real records", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const data = await caller.inspection.school({});
    expect(data.thread.assurance.policies).toBe(1);
    expect(data.thread.compliance.overallLabel.length).toBeGreaterThan(0);
    expect(data.thread.identification).toHaveProperty("active");
  });

  it("denies the trust view to a DSL", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await expect(caller.inspection.trust()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
