import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Documents vault, contextual search, viewer and evidence pack against the real
// database, with RLS isolation between schools.

const run = randomUUID().slice(0, 8);

let schoolAId: string;
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
    data: { name: "Downlands", slug: `doc-a-${run}` },
  });
  const o = await systemDb.tenant.create({
    data: { name: "Elsewhere", slug: `doc-o-${run}` },
  });
  schoolAId = a.id;
  otherSchoolId = o.id;
  dsl = await systemDb.user.create({
    data: { email: `doc-dsl-${run}@a.test`, role: "DSL", tenantId: schoolAId },
  });

  await systemDb.document.create({
    data: {
      tenantId: schoolAId,
      scope: "ORG",
      title: "Online Safety and Filtering Policy",
      type: "Policy",
      docDate: new Date("2025-09-12"),
      status: "Current",
      themes: ["online safety", "filtering"],
      summary: "Online incident response.",
      content:
        "Where a child discloses contact from an unknown adult, staff preserve evidence and escalate to the DSL.",
      source: "seed",
    },
  });
  await systemDb.document.create({
    data: {
      tenantId: schoolAId,
      scope: "ORG",
      title: "Attendance Strategy",
      type: "Policy",
      docDate: new Date("2026-01-09"),
      status: "Current",
      themes: ["attendance", "welfare"],
      summary: "Persistent absence.",
      content:
        "A young carer with caring responsibilities may show a pattern of lateness.",
      source: "seed",
    },
  });
});

afterAll(async () => {
  const ids = [schoolAId, otherSchoolId];
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.document.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.user.deleteMany({ where: { id: dsl.id } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
});

describe("documents.vault", () => {
  it("lists the school's org documents", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const vault = await caller.documents.vault({});
    expect(vault.documents.length).toBe(2);
  });
});

describe("documents.search", () => {
  it("finds a document by its content and explains the match, audited", async () => {
    const caller = createCaller(await ctxFor(dsl));
    // "young carer" appears only in the attendance doc's body.
    const result = await caller.documents.search({ query: "young carer" });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]!.title).toBe("Attendance Strategy");
    expect(result.synthesis).toContain("Found");

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "documents.searched" },
    });
    expect(events.length).toBeGreaterThan(0);
  });

  it("matches themes, not filenames", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const result = await caller.documents.search({ query: "filtering" });
    expect(result.hits[0]!.matchedThemes).toContain("filtering");
  });
});

describe("documents.evidencePack", () => {
  it("assembles a generated pack from the vault", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const pack = await caller.documents.evidencePack({});
    const doc = await caller.documents.byId({ id: pack.id });
    expect(doc.title).toBe("Inspection Evidence Pack");
    expect(doc.content).toContain("Downlands");
    expect(doc.content).not.toContain("—");
  });
});

describe("documents.trustVault", () => {
  let trustId: string;
  let tvA: string;
  let tvB: string;
  let director: User;
  let tvDsl: User;

  beforeAll(async () => {
    const trust = await systemDb.trust.create({
      data: { name: `Doc Trust ${run}`, slug: `doc-trust-${run}` },
    });
    trustId = trust.id;
    const a = await systemDb.tenant.create({
      data: { name: "TV North", slug: `tv-a-${run}`, trustId },
    });
    const b = await systemDb.tenant.create({
      data: { name: "TV South", slug: `tv-b-${run}`, trustId },
    });
    tvA = a.id;
    tvB = b.id;
    director = await systemDb.user.create({
      data: { email: `tv-dir-${run}@t.test`, role: "DIRECTOR", trustId },
    });
    tvDsl = await systemDb.user.create({
      data: { email: `tv-dsl-${run}@a.test`, role: "DSL", tenantId: tvA },
    });

    await systemDb.document.createMany({
      data: [
        {
          tenantId: tvA,
          scope: "ORG",
          title: "North CP Policy",
          type: "Policy",
          docDate: new Date("2025-09-01"),
          status: "Current",
          themes: ["policy"],
          summary: "x",
          content: "x",
          source: "seed",
        },
        {
          tenantId: tvB,
          scope: "ORG",
          title: "South CP Policy",
          type: "Policy",
          docDate: new Date("2026-02-01"),
          status: "Current",
          themes: ["policy"],
          summary: "x",
          content: "x",
          source: "seed",
        },
        {
          tenantId: tvB,
          scope: "ORG",
          title: "South Training Record",
          type: "Training",
          docDate: new Date("2025-10-01"),
          status: "Filed",
          themes: ["training"],
          summary: "x",
          content: "x",
          source: "seed",
        },
      ],
    });
  });

  afterAll(async () => {
    const ids = [tvA, tvB];
    await systemDb.document.deleteMany({ where: { tenantId: { in: ids } } });
    await systemDb.user.deleteMany({
      where: { id: { in: [director.id, tvDsl.id] } },
    });
    await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
    await systemDb.trust.deleteMany({ where: { id: trustId } });
  });

  it("rolls up every school's documents for a director", async () => {
    const caller = createCaller(await ctxFor(director));
    const vault = await caller.documents.trustVault();
    expect(vault.totals.schools).toBe(2);
    expect(vault.totals.documents).toBe(3);
    expect(vault.schools.find((s) => s.name === "TV South")!.total).toBe(2);
    // Merged list is sorted newest first, across schools.
    expect(vault.documents[0]!.title).toBe("South CP Policy");
    // Type facet spans the trust.
    expect(vault.types.find((t) => t.type === "Policy")!.count).toBe(2);
  });

  it("filters the repository by school and type", async () => {
    const caller = createCaller(await ctxFor(director));
    const bySchool = await caller.documents.trustVault({ schoolId: tvB });
    expect(bySchool.documents.every((d) => d.schoolId === tvB)).toBe(true);
    expect(bySchool.shown).toBe(2);
    expect(bySchool.total).toBe(3); // total is the pre-filter trust set
    // Type facet comes from the unfiltered set, so it does not collapse.
    expect(bySchool.types.find((t) => t.type === "Policy")!.count).toBe(2);

    const training = await caller.documents.trustVault({ type: "Training" });
    expect(training.documents).toHaveLength(1);
    expect(training.documents[0]!.title).toBe("South Training Record");
  });

  it("runs conversational search across every school for a director", async () => {
    const caller = createCaller(await ctxFor(director));
    const result = await caller.documents.trustSearch({ query: "policy" });
    expect(result.hits.length).toBeGreaterThanOrEqual(2);
    // Each hit carries the school it belongs to.
    expect(result.hits.every((h) => h.schoolName.length > 0)).toBe(true);
    expect(result.synthesis).toContain("Found");
  });

  it("denies a DSL the trust repository", async () => {
    const caller = createCaller(await ctxFor(tvDsl));
    await expect(caller.documents.trustVault()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      caller.documents.trustSearch({ query: "policy" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("RLS", () => {
  it("keeps documents scoped to their school", async () => {
    const docs = await dbForTenant(otherSchoolId).document.findMany({
      where: { tenantId: schoolAId },
    });
    expect(docs).toHaveLength(0);
  });
});
