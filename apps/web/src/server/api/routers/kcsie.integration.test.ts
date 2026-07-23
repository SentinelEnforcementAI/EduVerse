import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// KCSIE compliance and the component workspace against the real database.

const run = randomUUID().slice(0, 8);

let schoolId: string;
let otherSchoolId: string;
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
  const a = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `kc-a-${run}` },
  });
  const o = await systemDb.tenant.create({
    data: { name: "Elsewhere", slug: `kc-o-${run}` },
  });
  schoolId = a.id;
  otherSchoolId = o.id;
  dsl = await systemDb.user.create({
    data: { email: `kc-dsl-${run}@a.test`, name: "A DSL", role: "DSL", tenantId: schoolId },
  });

  // Seed the documents compliance derives from.
  await systemDb.document.createMany({
    data: [
      {
        tenantId: schoolId,
        scope: "ORG",
        title: "Child Protection Policy",
        type: "Policy",
        docDate: new Date("2026-01-06"),
        status: "Current",
        themes: ["child protection"],
        summary: "CP policy.",
        content: "Policy body.",
      },
      {
        tenantId: schoolId,
        scope: "ORG",
        title: "Single Central Record",
        type: "Record",
        docDate: new Date("2026-04-21"),
        status: "Current",
        themes: ["safer recruitment"],
        summary: "SCR.",
        content: "SCR body.",
      },
    ],
  });
});

afterAll(async () => {
  const ids = [schoolId, otherSchoolId];
  await systemDb.kcsieEvidence.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.kcsieTask.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.document.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.user.deleteMany({ where: { id: dsl.id } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
});

describe("kcsie.school", () => {
  it("derives seven components from the school's records", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const data = await caller.kcsie.school({});
    expect(data.components).toHaveLength(7);
    const policy = data.components.find((c) => c.key === "policy")!;
    expect(policy.status).toBe("ok");
    const scr = data.components.find((c) => c.key === "scr")!;
    expect(scr.status).toBe("ok");
  });
});

describe("kcsie.section175 and compliancePack", () => {
  it("pre-fills a section 175 return with no em dashes", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const r = await caller.kcsie.section175({});
    const doc = await caller.documents.byId({ id: r.id });
    expect(doc.title).toContain("Section 175");
    expect(doc.content).not.toContain("—");
  });

  it("generates a governor compliance pack", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const r = await caller.kcsie.compliancePack({});
    const doc = await caller.documents.byId({ id: r.id });
    expect(doc.title).toContain("Compliance Pack");
  });
});

describe("kcsie component workspace", () => {
  it("adds and completes a task, attaches evidence, all audited", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const before = await caller.kcsie.component({ key: "scr" });
    expect(before.owner).toBe("A DSL");

    const task = await caller.kcsie.addTask({
      key: "scr",
      label: "Check three new starters",
    });
    await caller.kcsie.toggleTask({ taskId: task.id });

    const docId = before.availableDocuments[0]!.id;
    await caller.kcsie.attachEvidence({ key: "scr", documentId: docId });

    const after = await caller.kcsie.component({ key: "scr" });
    expect(after.tasks).toHaveLength(1);
    expect(after.tasks[0]!.done).toBe(true);
    expect(after.evidence).toHaveLength(1);
    expect(after.activity.length).toBeGreaterThan(0);
  });

  it("keeps workspace data scoped to its school (RLS)", async () => {
    const tasks = await dbForTenant(otherSchoolId).kcsieTask.findMany({
      where: { componentKey: "scr" },
    });
    expect(tasks).toHaveLength(0);
  });
});
