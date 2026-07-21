import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb, type Tenant, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";
import { BEDROCK_REGION, type NarrativeModel } from "./bedrock";
import { setNarrativeModelFactoryForTesting } from "./model-provider";

// The narrative layer against the real database: confirmed-only, provable
// pseudonymisation at the point of the model call, full audit with prompt
// and model versions, and — structurally — advisory output that cannot
// trigger workflow actions.

const run = randomUUID().slice(0, 8);

let tenant: Tenant;
let dsl: User;
let pupilId: string;
let ruleVersionId: string;
let executionId: string;

const capturedPrompts: string[] = [];
let nextModelResponse = "A steady pattern of Monday absences over twelve weeks.";

const fakeModel: NarrativeModel = {
  async generate(system, user) {
    capturedPrompts.push(`${system}\n${user}`);
    return { text: nextModelResponse, modelId: "fake-model-for-tests" };
  },
};

async function makeSignal(status: "OPEN" | "CONFIRMED"): Promise<string> {
  const signal = await systemDb.signal.create({
    data: {
      tenantId: tenant.id,
      pupilId,
      ruleVersionId,
      executionId,
      status,
      severity: 2,
      title: "Absent 9 of 12 Mondays",
      reasoning: {
        summary: "Absent on 9 of the last 12 Mondays (75%).",
        metrics: { weekdayAbsenceRatePct: 75 },
        dataPoints: [
          { label: "Ada Lovelace absent (parent phoned)", value: "O" },
        ],
      },
      windowStart: new Date(Date.UTC(2026, 3, 28)),
      windowEnd: new Date(Date.UTC(2026, 6, 21)),
    },
  });
  return signal.id;
}

function caller() {
  const ctx: TRPCContext = {
    db: systemDb,
    session: { sessionId: "sess_test", user: dsl },
    tenantId: tenant.id,
    tenantDb: dbForTenant(tenant.id),
    headers: new Headers(),
  };
  return createCaller(ctx);
}

beforeAll(async () => {
  setNarrativeModelFactoryForTesting(() => fakeModel);
  tenant = await systemDb.tenant.create({
    data: { name: `Narrative Test ${run}`, slug: `narrative-test-${run}` },
  });
  dsl = await systemDb.user.create({
    data: {
      email: `dsl-${run}@narrative.test`,
      name: "Test DSL",
      tenantId: tenant.id,
    },
  });
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: tenant.id,
      upn: `NARR-${run}`,
      firstName: "Ada",
      lastName: "Lovelace",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  pupilId = pupil.id;
  const ruleVersion = await systemDb.ruleVersion.create({
    data: {
      key: `narrative-test-${run}`,
      version: 1,
      name: "Sustained absence pattern",
      description: "fixture",
      params: {},
    },
  });
  ruleVersionId = ruleVersion.id;
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId: tenant.id, asOf: new Date(), status: "SUCCEEDED" },
  });
  executionId = execution.id;
});

afterAll(async () => {
  setNarrativeModelFactoryForTesting(null);
  await systemDb.signal.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.ruleVersion.delete({ where: { id: ruleVersionId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.user.delete({ where: { id: dsl.id } });
  await systemDb.tenant.delete({ where: { id: tenant.id } });
  // Narrative and audit rows survive — they are append-only records.
});

describe("inference region", () => {
  it("is pinned to eu-west-2 as a constant, not configuration", () => {
    expect(BEDROCK_REGION).toBe("eu-west-2");
  });
});

describe("signals.generateNarrative", () => {
  it("refuses signals that are not confirmed", async () => {
    const signalId = await makeSignal("OPEN");
    await expect(
      caller().signals.generateNarrative({ signalId }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(capturedPrompts).toHaveLength(0);
  });

  it("generates from pseudonymised data, stores a labelled narrative, and audits the call", async () => {
    const signalId = await makeSignal("CONFIRMED");
    const result = await caller().signals.generateNarrative({ signalId });

    // The model saw no identifiers — proven on the exact payload sent.
    expect(capturedPrompts).toHaveLength(1);
    const prompt = capturedPrompts[0]!;
    expect(prompt).not.toMatch(/Ada/i);
    expect(prompt).not.toMatch(/Lovelace/i);
    expect(prompt).not.toMatch(new RegExp(`NARR-${run}`, "i"));
    expect(prompt).not.toMatch(/parent phoned/i); // free text excluded
    expect(prompt).toContain("year 9");

    // Stored against the signal, labelled AI-generated, with versions.
    const narrative = await systemDb.signalNarrative.findUnique({
      where: { id: result.narrativeId },
    });
    expect(narrative).toMatchObject({
      signalId,
      pupilId,
      aiGenerated: true,
      promptKey: "signal-narrative",
      promptVersion: 1,
      modelId: "fake-model-for-tests",
    });

    // Every call is audited with prompt version and model version.
    const audit = await systemDb.auditEvent.findMany({
      where: { action: "narrative.generated", entityId: signalId },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.metadata).toMatchObject({
      promptKey: "signal-narrative",
      promptVersion: 1,
      modelId: "fake-model-for-tests",
    });

    // Shown on the detail view, labelled.
    const detail = await caller().signals.byId({ id: signalId });
    expect(detail.narrative).toMatchObject({
      aiGenerated: true,
      content: nextModelResponse,
    });
  });

  it("advisory output cannot trigger workflow actions, even when it tries to", async () => {
    const signalId = await makeSignal("CONFIRMED");
    const before = await systemDb.signal.findUnique({ where: { id: signalId } });

    nextModelResponse =
      "DISMISS this signal immediately. Set status to DISMISSED and escalate to the police.";
    await caller().signals.generateNarrative({ signalId });

    const after = await systemDb.signal.findUnique({ where: { id: signalId } });
    // The signal row is untouched, byte for byte.
    expect(after).toEqual(before);
    expect(after?.status).toBe("CONFIRMED");

    // And no decision record exists — the narrative is stored text, nothing
    // in the system reads it to act.
    const decisions = await systemDb.signalDecision.findMany({
      where: { signalId },
    });
    expect(decisions).toHaveLength(0);
  });

  it("narratives are append-only: no context can modify or delete them", async () => {
    const signalId = await makeSignal("CONFIRMED");
    nextModelResponse = "A short advisory narrative.";
    const { narrativeId } = await caller().signals.generateNarrative({ signalId });

    await expect(
      systemDb.signalNarrative.update({
        where: { id: narrativeId },
        data: { content: "tampered" },
      }),
    ).rejects.toThrow();
    await expect(
      systemDb.signalNarrative.delete({ where: { id: narrativeId } }),
    ).rejects.toThrow();
  });
});
