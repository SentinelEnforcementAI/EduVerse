import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { systemDb } from "@sentinel/db";

import { syncSandboxSchool } from "../src/sandbox";
import { WondeClient } from "../src/wonde/client";
import { FakeWondeTransport, fixtureSchool } from "./fake-wonde";

// End-to-end orchestration for connecting a Wonde school as a live school:
// against fixture data (no network), it must link a tenant, ingest the roll and
// its attendance / behaviour / attainment, and run the rules engine — proving
// the whole one-click path short of the real API's field nesting.

const run = randomUUID().slice(0, 8);
const trustSlug = `sbx-trust-${run}`;
const schoolSlug = `sbx-school-${run}`;
const WONDE_SCHOOL_ID = `WSCHOOL-${run}`;

afterAll(async () => {
  const tenant = await systemDb.tenant.findUnique({ where: { slug: schoolSlug } });
  if (tenant) {
    await systemDb.signal.deleteMany({ where: { tenantId: tenant.id } });
    await systemDb.ruleExecution.deleteMany({ where: { tenantId: tenant.id } });
    await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
    await systemDb.user.deleteMany({ where: { tenantId: tenant.id } });
    await systemDb.tenant.delete({ where: { id: tenant.id } });
  }
  await systemDb.trust.deleteMany({ where: { slug: trustSlug } });
});

describe("syncSandboxSchool", () => {
  it("links a tenant, ingests the Wonde roll and data, and runs the engine", async () => {
    await systemDb.trust.create({
      data: { name: `Sandbox Trust ${run}`, slug: trustSlug },
    });

    const client = new WondeClient(
      new FakeWondeTransport(WONDE_SCHOOL_ID, fixtureSchool()),
    );

    const report = await syncSandboxSchool(client, {
      trustSlug,
      schoolSlug,
      schoolName: "Sandbox School",
      wondeSchoolId: WONDE_SCHOOL_ID,
    });

    // The tenant is created inside the trust and linked to the Wonde school.
    const tenant = await systemDb.tenant.findUnique({
      where: { slug: schoolSlug },
    });
    expect(tenant?.wondeSchoolId).toBe(WONDE_SCHOOL_ID);
    expect(tenant?.wondeConnectedAt).toBeTruthy();

    // The roll came in (3 fixture students) and their data attached.
    expect(report.students.created).toBe(3);
    const pupils = await systemDb.pupil.count({
      where: { tenantId: tenant!.id },
    });
    expect(pupils).toBe(3);
    expect(report.attendance.created).toBeGreaterThan(0);
    expect(report.behaviour.created).toBeGreaterThan(0);
    expect(report.attainment.created).toBeGreaterThan(0);

    // The engine ran successfully over the ingested data.
    expect(report.rulesStatus).toBe("SUCCEEDED");

    // Re-running converges (idempotent): no new pupils created.
    const second = await syncSandboxSchool(client, {
      trustSlug,
      schoolSlug,
      schoolName: "Sandbox School",
      wondeSchoolId: WONDE_SCHOOL_ID,
    });
    expect(second.students.created).toBe(0);
    expect(second.students.updated).toBe(3);
  }, 60_000);
});
