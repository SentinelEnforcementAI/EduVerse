import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";
import { setNarrativeModelFactoryForTesting } from "@/server/narrative/model-provider";

// The advisory LLM layer: every generated surface enhances a deterministic
// fallback, logs the call, and never throws. When the model is unavailable the
// fallback is used silently; when it answers, its output is used and logged.

const run = randomUUID().slice(0, 8);
let schoolId: string;
let dsl: User;
let signalId: string;

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

const throwingModel = {
  generate: async () => {
    throw new Error("model unavailable");
  },
};

beforeAll(async () => {
  const s = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `adv-${run}` },
  });
  schoolId = s.id;
  dsl = await systemDb.user.create({
    data: { email: `adv-${run}@a.test`, name: "A DSL", role: "DSL", tenantId: schoolId },
  });
  await systemDb.document.create({
    data: {
      tenantId: schoolId,
      scope: "ORG",
      title: "Online Safety Policy",
      type: "Policy",
      docDate: new Date("2025-09-12"),
      status: "Current",
      themes: ["online safety"],
      summary: "Online incidents.",
      content: "Staff preserve evidence and escalate to the DSL.",
    },
  });
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: schoolId,
      upn: `ADV-${run}`,
      firstName: "Test",
      lastName: "Pupil",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  const rv = await systemDb.ruleVersion.create({
    data: { key: `adv-${run}`, version: 1, name: "Rule", description: "x", params: {} },
  });
  const ex = await systemDb.ruleExecution.create({
    data: { tenantId: schoolId, status: "SUCCEEDED", asOf: new Date() },
  });
  const signal = await systemDb.signal.create({
    data: {
      tenantId: schoolId,
      pupilId: pupil.id,
      ruleVersionId: rv.id,
      executionId: ex.id,
      severity: 2,
      title: "Pattern",
      reasoning: { summary: "Attendance has fallen.", metrics: { drop: 30 }, dataPoints: [] },
      windowStart: new Date(Date.UTC(2026, 3, 14)),
      windowEnd: new Date(Date.UTC(2026, 3, 28)),
    },
  });
  signalId = signal.id;
});

afterEach(() => setNarrativeModelFactoryForTesting(null));

afterAll(async () => {
  setNarrativeModelFactoryForTesting(null);
  await systemDb.llmCall.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.document.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.signal.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: schoolId } });
  await systemDb.ruleVersion.deleteMany({ where: { key: { contains: run } } });
  await systemDb.user.deleteMany({ where: { id: dsl.id } });
  await systemDb.tenant.deleteMany({ where: { id: schoolId } });
});

describe("search synthesis (advisory)", () => {
  it("falls back silently and logs the call when the model is unavailable", async () => {
    setNarrativeModelFactoryForTesting(() => throwingModel);
    const caller = createCaller(await ctxFor(dsl));
    const result = await caller.documents.search({ query: "online safety" });
    expect(result.synthesis).toContain("Found");
    expect(result.synthesisSource).toBe("fallback");

    const calls = await dbForTenant(schoolId).llmCall.findMany({
      where: { surface: "search-synthesis" },
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]!.source).toBe("fallback");
    expect(calls[0]!.advisory).toBe(true);
  });

  it("uses the model output when the model answers", async () => {
    setNarrativeModelFactoryForTesting(() => ({
      generate: async () => ({ text: "A model summary.", modelId: "test-model" }),
    }));
    const caller = createCaller(await ctxFor(dsl));
    const result = await caller.documents.search({ query: "online safety" });
    expect(result.synthesis).toBe("A model summary.");
    expect(result.synthesisSource).toBe("llm");
  });
});

describe("comms draft (advisory)", () => {
  it("returns the deterministic draft when the model is unavailable", async () => {
    setNarrativeModelFactoryForTesting(() => throwingModel);
    const caller = createCaller(await ctxFor(dsl));
    const draft = await caller.casework.draftComm({ signalId, type: "parent" });
    expect(draft.body).toContain("Dear Parent or Carer");
    expect(draft.source).toBe("fallback");
  });
});
