import { randomUUID } from "node:crypto";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  dbForTenant,
  resolveTenancy,
  systemDb,
  type User,
} from "@sentinel/db";

import { createCaller } from "@/server/api/root";
import type { TRPCContext } from "@/server/api/trpc";
import { setInvoicerForTesting } from "@/server/billing/invoicing";

// Billing + metering against the real database, with the invoicing provider
// stubbed: an admin sees the trust's basis (pupils × per-pupil + the MAT fee),
// meters it into a snapshot, and issues an invoice; every action is audited and
// scoped to the admin's own trust; a director or DSL cannot reach it.

const run = randomUUID().slice(0, 8);

const PER_PUPIL = 500; // account default
const MAT_FEE = 5_000_000; // account default (£50,000)

let trustId: string;
let schoolAId: string;
let schoolBId: string;
let otherTrustId: string;
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

async function seedPupils(tenantId: string, n: number, tag: string) {
  for (let i = 0; i < n; i++) {
    await systemDb.pupil.create({
      data: {
        tenantId,
        upn: `BILL-${tag}-${i}-${run}`,
        firstName: "P",
        lastName: "Q",
        yearGroup: 9,
        registrationGroup: "9A",
        dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
      },
    });
  }
}

beforeAll(async () => {
  const trust = await systemDb.trust.create({
    data: { name: `Bill Trust ${run}`, slug: `bill-t-${run}` },
  });
  trustId = trust.id;
  const other = await systemDb.trust.create({
    data: { name: `Bill Other ${run}`, slug: `bill-o-${run}` },
  });
  otherTrustId = other.id;

  const a = await systemDb.tenant.create({
    data: { name: `Aaa ${run}`, slug: `bill-a-${run}`, trustId },
  });
  schoolAId = a.id;
  const b = await systemDb.tenant.create({
    data: { name: `Bbb ${run}`, slug: `bill-b-${run}`, trustId },
  });
  schoolBId = b.id;

  await systemDb.billingAccount.create({ data: { trustId } });

  // 3 pupils in A, 2 in B → 5 across the trust.
  await seedPupils(schoolAId, 3, "a");
  await seedPupils(schoolBId, 2, "b");

  admin = await systemDb.user.create({
    data: { email: `bill-admin-${run}@t.test`, role: "ADMIN", trustId },
  });
  director = await systemDb.user.create({
    data: { email: `bill-dir-${run}@t.test`, role: "DIRECTOR", trustId },
  });
  dsl = await systemDb.user.create({
    data: { email: `bill-dsl-${run}@a.test`, role: "DSL", tenantId: schoolAId },
  });
});

afterEach(() => setInvoicerForTesting(null));

afterAll(async () => {
  const ids = [schoolAId, schoolBId];
  await systemDb.billingSnapshot.deleteMany({
    where: { trustId: { in: [trustId, otherTrustId] } },
  });
  await systemDb.billingAccount.deleteMany({
    where: { trustId: { in: [trustId, otherTrustId] } },
  });
  await systemDb.auditEvent.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.pupil.deleteMany({ where: { tenantId: { in: ids } } });
  await systemDb.user.deleteMany({ where: { email: { contains: run } } });
  await systemDb.tenant.deleteMany({ where: { id: { in: ids } } });
  await systemDb.trust.deleteMany({
    where: { slug: { in: [`bill-t-${run}`, `bill-o-${run}`] } },
  });
});

describe("billing.summary", () => {
  it("meters pupils across the trust and applies the MAT fee once", async () => {
    const caller = createCaller(await ctxFor(admin));
    const basis = await caller.billing.summary();

    expect(basis.pupilCount).toBe(5);
    expect(basis.perPupilPence).toBe(PER_PUPIL);
    expect(basis.matFeePence).toBe(MAT_FEE);
    expect(basis.usagePence).toBe(5 * PER_PUPIL);
    expect(basis.totalPence).toBe(5 * PER_PUPIL + MAT_FEE);
    expect(basis.hasAccount).toBe(true);

    const perSchool = new Map(basis.schools.map((s) => [s.id, s.pupilCount]));
    expect(perSchool.get(schoolAId)).toBe(3);
    expect(perSchool.get(schoolBId)).toBe(2);
  });

  it("is denied to a director and a DSL", async () => {
    for (const u of [director, dsl]) {
      const caller = createCaller(await ctxFor(u));
      await expect(caller.billing.summary()).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
  });
});

describe("billing.takeSnapshot / issueInvoice", () => {
  it("freezes the amounts into a DRAFT snapshot and audits it", async () => {
    const caller = createCaller(await ctxFor(admin));
    const snap = await caller.billing.takeSnapshot({
      periodStart: new Date(Date.UTC(2026, 6, 1)),
      periodEnd: new Date(Date.UTC(2026, 7, 1)),
    });

    expect(snap.pupilCount).toBe(5);
    expect(snap.totalPence).toBe(5 * PER_PUPIL + MAT_FEE);
    expect(snap.invoiceStatus).toBe("DRAFT");

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "billing.snapshot_taken", entityId: snap.id },
    });
    expect(audits.length).toBeGreaterThan(0);
  });

  it("issues an invoice via the provider, moves to ISSUED, and blocks re-issue", async () => {
    setInvoicerForTesting(async () => ({ stripeInvoiceId: `in_test_${run}` }));
    const caller = createCaller(await ctxFor(admin));

    const snap = await caller.billing.takeSnapshot({
      periodStart: new Date(Date.UTC(2026, 5, 1)),
      periodEnd: new Date(Date.UTC(2026, 6, 1)),
    });

    const issued = await caller.billing.issueInvoice({ snapshotId: snap.id });
    expect(issued.invoiceStatus).toBe("ISSUED");
    expect(issued.stripeInvoiceId).toBe(`in_test_${run}`);

    const audits = await dbForTenant(schoolAId).auditEvent.findMany({
      where: { action: "billing.invoice_issued", entityId: snap.id },
    });
    expect(audits.length).toBeGreaterThan(0);

    // A second issue is refused.
    await expect(
      caller.billing.issueInvoice({ snapshotId: snap.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("cannot issue an invoice for another trust's snapshot", async () => {
    const foreign = await systemDb.billingSnapshot.create({
      data: {
        trustId: otherTrustId,
        periodStart: new Date(Date.UTC(2026, 5, 1)),
        periodEnd: new Date(Date.UTC(2026, 6, 1)),
        pupilCount: 1,
        perPupilPence: PER_PUPIL,
        matFeePence: MAT_FEE,
        usagePence: PER_PUPIL,
        totalPence: PER_PUPIL + MAT_FEE,
        currency: "GBP",
      },
    });
    const caller = createCaller(await ctxFor(admin));
    await expect(
      caller.billing.issueInvoice({ snapshotId: foreign.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
