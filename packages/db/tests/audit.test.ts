import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb } from "../src";

// Audit events are append-only at the database layer: the migration creates
// SELECT and INSERT policies only, so under FORCE RLS no connection — not
// even the system context — can update or delete an entry. Safeguarding
// records are never rewritten.

const run = randomUUID().slice(0, 8);
let tenantId: string;
let eventId: string;

beforeAll(async () => {
  const tenant = await systemDb.tenant.create({
    data: { name: `Audit Test ${run}`, slug: `audit-test-${run}` },
  });
  tenantId = tenant.id;
  const event = await dbForTenant(tenantId).auditEvent.create({
    data: {
      tenantId,
      userId: null,
      action: "test.created",
      entityType: "test",
    },
  });
  eventId = event.id;
});

afterAll(async () => {
  // The tenant row can go; its audit events deliberately cannot (no FK, no
  // DELETE policy) — audit history outlives what it references.
  await systemDb.tenant.delete({ where: { id: tenantId } });
});

describe("audit_events append-only", () => {
  it("tenant contexts can write and read their own events", async () => {
    const events = await dbForTenant(tenantId).auditEvent.findMany({
      where: { tenantId },
    });
    expect(events.map((e) => e.id)).toContain(eventId);
  });

  it("other tenants cannot read them", async () => {
    const other = await systemDb.tenant.create({
      data: { name: `Audit Other ${run}`, slug: `audit-other-${run}` },
    });
    const events = await dbForTenant(other.id).auditEvent.findMany({
      where: { tenantId },
    });
    expect(events).toHaveLength(0);
    await systemDb.tenant.delete({ where: { id: other.id } });
  });

  it("no context can modify an audit event — not even system", async () => {
    await expect(
      dbForTenant(tenantId).auditEvent.update({
        where: { id: eventId },
        data: { action: "tampered" },
      }),
    ).rejects.toThrow();

    await expect(
      systemDb.auditEvent.update({
        where: { id: eventId },
        data: { action: "tampered" },
      }),
    ).rejects.toThrow();

    const untouched = await systemDb.auditEvent.findUnique({
      where: { id: eventId },
    });
    expect(untouched?.action).toBe("test.created");
  });

  it("no context can delete an audit event — not even system", async () => {
    await expect(
      dbForTenant(tenantId).auditEvent.delete({ where: { id: eventId } }),
    ).rejects.toThrow();
    await expect(
      systemDb.auditEvent.delete({ where: { id: eventId } }),
    ).rejects.toThrow();

    expect(
      await systemDb.auditEvent.count({ where: { id: eventId } }),
    ).toBe(1);
  });
});
