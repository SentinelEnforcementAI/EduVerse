import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  dbForTenant,
  resolveTenancy,
  systemDb,
  type User,
} from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Rules tuning against the real database: an admin reads the catalog, sets and
// resets per-trust thresholds (validated, audited), and a director or DSL
// cannot reach it. The engine's use of these overrides is covered in the rules
// package's tuning test.

const run = randomUUID().slice(0, 8);
const RULE = "attendance-drop";
const PARAM = "minDropPercentagePoints";

let trustId: string;
let schoolAId: string;
let admin: User;
let director: User;
let dsl: User;

async function ctxFor(user: User): Promise<TRPCContext> {
  const tenancy = await resolveTenancy(user);
  return {
    db: systemDb,
    session: { sessionId: `sess-${run}`, user },
    tenantId: user.tenantId,
    tenantDb: user.tenantId ? dbForTenant(user.tenantId) : null,
    tenancy,
    headers: new Headers(),
  };
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `Rules Trust ${run}`, slug: `ru-trust-${run}` },
  });
  trustId = trust.id;
  const school = await systemDb.tenant.create({
    data: { name: `School ${run}`, slug: `ru-a-${run}`, trustId },
  });
  schoolAId = school.id;

  admin = await systemDb.user.create({
    data: { email: `ru-admin-${run}@t.test`, role: "ADMIN", trustId },
  });
  director = await systemDb.user.create({
    data: { email: `ru-dir-${run}@t.test`, role: "DIRECTOR", trustId },
  });
  dsl = await systemDb.user.create({
    data: { email: `ru-dsl-${run}@a.test`, role: "DSL", tenantId: schoolAId },
  });
});

afterAll(async () => {
  await systemDb.ruleConfig.deleteMany({ where: { trustId } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: schoolAId } });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: schoolAId } });
  await systemDb.trust.deleteMany({ where: { id: trustId } });
});

describe("rules.list", () => {
  it("returns the catalog with defaults and no override initially", async () => {
    const caller = createCaller(await ctxFor(admin));
    const rules = await caller.rules.list();
    const rule = rules.find((r) => r.key === RULE)!;
    expect(rule).toBeTruthy();
    expect(rule.tuned).toBe(false);
    expect(rule.effective[PARAM]).toBe(rule.defaults[PARAM]);
  });

  it("is denied to a director and a DSL", async () => {
    for (const u of [director, dsl]) {
      const caller = createCaller(await ctxFor(u));
      await expect(caller.rules.list()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });
});

describe("rules.setThresholds", () => {
  it("sets an override, reflects it in effective, and audits it", async () => {
    const caller = createCaller(await ctxFor(admin));
    await caller.rules.setThresholds({ ruleKey: RULE, params: { [PARAM]: 25 } });

    const rules = await caller.rules.list();
    const rule = rules.find((r) => r.key === RULE)!;
    expect(rule.tuned).toBe(true);
    expect(rule.override[PARAM]).toBe(25);
    expect(rule.effective[PARAM]).toBe(25);

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "rule.thresholds_set", entityId: RULE },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("rejects an unknown threshold key, a non-positive value, and an unknown rule", async () => {
    const caller = createCaller(await ctxFor(admin));
    await expect(
      caller.rules.setThresholds({ ruleKey: RULE, params: { nonsense: 5 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.rules.setThresholds({ ruleKey: RULE, params: { [PARAM]: -1 } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.rules.setThresholds({ ruleKey: "no-such-rule", params: {} }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("rules.reset", () => {
  it("clears the override so effective returns to the defaults", async () => {
    const caller = createCaller(await ctxFor(admin));
    await caller.rules.reset({ ruleKey: RULE });

    const rules = await caller.rules.list();
    const rule = rules.find((r) => r.key === RULE)!;
    expect(rule.tuned).toBe(false);
    expect(rule.effective[PARAM]).toBe(rule.defaults[PARAM]);
  });
});
