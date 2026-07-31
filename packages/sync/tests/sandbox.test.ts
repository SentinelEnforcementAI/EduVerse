import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { systemDb } from "@sentinel/db";

import { syncSandboxSchool } from "../src/sandbox";
import { WondeApiError, WondeClient, type WondeTransport } from "../src/wonde/client";
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

    // Every scope was granted, so nothing was skipped.
    expect(report.skippedDomains).toEqual([]);

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

  it("connects with the roll and skips a domain whose Wonde scope is not enabled", async () => {
    const scopeRun = randomUUID().slice(0, 8);
    const scopeTrust = `sbx-trust-${scopeRun}`;
    const scopeSchool = `sbx-school-${scopeRun}`;
    const scopeWondeId = `WSCHOOL-${scopeRun}`;

    await systemDb.trust.create({
      data: { name: `Scope Trust ${scopeRun}`, slug: scopeTrust },
    });

    // Own fixture with unique ids/UPNs (upn is globally unique, and the first
    // test's pupils live until this file's afterAll).
    const fixture = fixtureSchool();
    const uid = (s: string) => `${scopeRun}-${s}`;
    for (const student of fixture.students) {
      student.id = uid(student.id);
      if (student.upi) student.upi = uid(student.upi);
    }
    for (const record of fixture.attendance) {
      if (record.student?.data?.id) record.student.data.id = uid(record.student.data.id);
    }
    for (const incident of fixture.behaviours) {
      if (incident.students?.data) {
        incident.students.data = incident.students.data.map((s) => ({ id: uid(s.id!) }));
      }
    }
    for (const result of fixture.results) {
      if (result.student?.data?.id) result.student.data.id = uid(result.student.data.id);
    }

    // Attendance scope not granted for this token: Wonde 403s that endpoint.
    // The connect must still ingest the roll and carry on.
    const base = new FakeWondeTransport(scopeWondeId, fixture);
    const scopeGatedTransport: WondeTransport = {
      get(path, params) {
        if (path.endsWith("/attendance/session")) {
          return Promise.reject(
            new WondeApiError(
              `Wonde API 403 on ${path}`,
              403,
              JSON.stringify({
                error: "invalid_permissions",
                error_description: "Scope attendance.read not enabled",
              }),
            ),
          );
        }
        return base.get(path, params);
      },
    };

    try {
      const report = await syncSandboxSchool(new WondeClient(scopeGatedTransport), {
        trustSlug: scopeTrust,
        schoolSlug: scopeSchool,
        schoolName: "Scope School",
        wondeSchoolId: scopeWondeId,
      });

      // Roll and the granted domains still came in.
      expect(report.students.created).toBe(3);
      expect(report.behaviour.created).toBeGreaterThan(0);
      expect(report.attainment.created).toBeGreaterThan(0);
      // Attendance was skipped, not fatal, and reported with its scope.
      expect(report.attendance).toEqual({ created: 0, updated: 0, skipped: 0 });
      expect(report.skippedDomains).toEqual([
        "attendance (Scope attendance.read not enabled)",
      ]);
      // The engine still ran over whatever data was available.
      expect(report.rulesStatus).toBe("SUCCEEDED");
    } finally {
      const tenant = await systemDb.tenant.findUnique({ where: { slug: scopeSchool } });
      if (tenant) {
        await systemDb.signal.deleteMany({ where: { tenantId: tenant.id } });
        await systemDb.ruleExecution.deleteMany({ where: { tenantId: tenant.id } });
        await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
        await systemDb.user.deleteMany({ where: { tenantId: tenant.id } });
        await systemDb.tenant.delete({ where: { id: tenant.id } });
      }
      await systemDb.trust.deleteMany({ where: { slug: scopeTrust } });
    }
  }, 60_000);
});
