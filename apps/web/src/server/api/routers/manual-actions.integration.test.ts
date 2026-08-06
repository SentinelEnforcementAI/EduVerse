import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, resolveTenancy, systemDb, type User } from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";

// Manually raised concerns and document uploads: the two human-initiated
// actions. Both must flow through the same sealed, audited, tenant-scoped path
// as everything the engine produces — a person flags, the workflow decides.

const run = randomUUID().slice(0, 8);
const UPN = `MAN${run.toUpperCase()}0001`;

let schoolAId: string;
let otherSchoolId: string;
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
    data: { name: `MAN Trust ${run}`, slug: `man-trust-${run}` },
  });
  const a = await systemDb.tenant.create({
    data: { name: "Downlands", slug: `man-a-${run}`, trustId: trust.id },
  });
  const o = await systemDb.tenant.create({
    data: { name: "Elsewhere", slug: `man-o-${run}` },
  });
  schoolAId = a.id;
  otherSchoolId = o.id;

  dsl = await systemDb.user.create({
    data: {
      email: `man-dsl-${run}@a.test`,
      name: "A DSL",
      role: "DSL",
      tenantId: schoolAId,
    },
  });

  // A pupil on school A's roll, with a distinctive name we assert never leaks.
  await systemDb.pupil.create({
    data: {
      tenantId: schoolAId,
      upn: UPN,
      firstName: "Beatrix",
      lastName: "Vaughan",
      yearGroup: 8,
      registrationGroup: "8B",
      dateOfBirth: new Date(Date.UTC(2012, 5, 1)),
    },
  });
});

afterAll(async () => {
  const ids = [schoolAId, otherSchoolId];
  await systemDb.document.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.signal.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.user.deleteMany({ where: { id: dsl.id } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({ where: { slug: `man-trust-${run}` } });
  // The shared manual rule version persists across tenants; leave it in place.
});

describe("raiseConcern (manual, sealed, audited)", () => {
  it("rejects a UPN that is not on the school's roll", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.casework.raiseConcern({
        schoolId: schoolAId,
        upn: "NOT-A-REAL-UPN",
        level: 2,
        title: "Test concern",
        reason: "Should not resolve to any pupil.",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("raises a sealed concern by UPN and audits it", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const res = await caller.casework.raiseConcern({
      schoolId: schoolAId,
      upn: UPN,
      level: 2,
      title: "Disclosure during form time",
      reason: "Pupil described a home situation that needs following up.",
    });

    expect(res.signalId).toBeTruthy();
    // The reference is sealed — a ref, never the name.
    expect(res.ref).toMatch(/^Pupil /);
    expect(JSON.stringify(res)).not.toContain("Beatrix");

    // The concern opens as a normal, sealed case.
    const c = await caller.casework.case({ signalId: res.signalId });
    expect(c.revealed).toBe(false);
    expect(c.pupilName).toBeNull();
    expect(JSON.stringify(c)).not.toContain("Beatrix");

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "concern.manually_raised", entityId: res.signalId },
    });
    expect(events.length).toBe(1);
    expect(events[0]!.metadata).toMatchObject({ level: 2 });
  });

  it("raises a level-4 concern as serious (revealable)", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const res = await caller.casework.raiseConcern({
      schoolId: schoolAId,
      upn: UPN,
      level: 4,
      title: "Immediate safeguarding disclosure",
      reason: "Serious disclosure requiring an immediate response.",
    });
    const c = await caller.casework.case({ signalId: res.signalId });
    expect(c.escalation.level).toBe(4);
    expect(c.revealable).toBe(true);
  });
});

describe("uploadDocument (sealed, audited, tenant-scoped)", () => {
  it("uploads a repository document and audits it", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const res = await caller.documents.uploadDocument({
      scope: "ORG",
      schoolId: schoolAId,
      title: "Safeguarding policy 2026",
      type: "Policy",
      note: "Reviewed and adopted by the governing body.",
    });
    expect(res.id).toBeTruthy();

    const doc = await dbForTenant(schoolAId).document.findUnique({
      where: { id: res.id },
    });
    expect(doc?.scope).toBe("ORG");
    expect(doc?.source).toBe("upload");

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "document.uploaded", entityId: res.id },
    });
    expect(events.length).toBe(1);
  });

  it("requires a note or a file", async () => {
    const caller = createCaller(await ctxFor(dsl));
    await expect(
      caller.documents.uploadDocument({
        scope: "ORG",
        schoolId: schoolAId,
        title: "Empty",
        type: "Note",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("attaches an uploaded document to a concern's case file", async () => {
    const caller = createCaller(await ctxFor(dsl));
    const concern = await caller.casework.raiseConcern({
      schoolId: schoolAId,
      upn: UPN,
      level: 3,
      title: "Concern for the case-document test",
      reason: "Raised so a document can be attached to its case file.",
    });
    const up = await caller.documents.uploadDocument({
      scope: "CASE",
      schoolId: schoolAId,
      signalId: concern.signalId,
      title: "Body map",
      type: "Record",
      note: "Recorded observations, filed to the case.",
    });
    expect(up.id).toBeTruthy();

    const c = await caller.casework.case({ signalId: concern.signalId });
    expect(c.documents.some((d) => d.title === "Body map")).toBe(true);

    const events = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "document.uploaded", entityId: concern.signalId },
    });
    expect(events.length).toBe(1);
  });

  it("keeps uploaded documents scoped to their school (RLS)", async () => {
    const docs = await dbForTenant(otherSchoolId).document.findMany({
      where: { source: "upload" },
    });
    expect(docs).toHaveLength(0);
  });
});
