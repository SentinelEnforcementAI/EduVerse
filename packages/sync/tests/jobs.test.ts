import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { systemDb, type Tenant } from "@sentinel/db";

import {
  runSync,
  syncAttendance,
  syncBehaviour,
  syncAttainment,
  syncStudents,
} from "../src/jobs/sync-jobs";
import { WondeClient } from "../src/wonde/client";
import { FakeWondeTransport, fixtureSchool } from "./fake-wonde";

// Idempotency is the contract for every sync job: running twice converges to
// the same database state, with the second run reporting updates, not
// creations. Runs against the real database (and real RLS).

const run = randomUUID().slice(0, 8);
const SCHOOL_ID = `A${run}`;

let tenant: Tenant;
let client: WondeClient;

beforeAll(async () => {
  tenant = await systemDb.tenant.create({
    data: {
      name: `Wonde Test ${run}`,
      slug: `wonde-test-${run}`,
      wondeSchoolId: SCHOOL_ID,
    },
  });
  client = new WondeClient(new FakeWondeTransport(SCHOOL_ID, fixtureSchool()));
});

afterAll(async () => {
  await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.tenant.delete({ where: { id: tenant.id } });
});

describe("syncStudents", () => {
  it("creates pupils on first run, updates on re-run", async () => {
    const first = await syncStudents(client, tenant);
    expect(first).toEqual({ created: 3, updated: 0, skipped: 0 });

    const second = await syncStudents(client, tenant);
    expect(second).toEqual({ created: 0, updated: 3, skipped: 0 });

    const pupils = await systemDb.pupil.findMany({
      where: { tenantId: tenant.id },
      orderBy: { upn: "asc" },
    });
    expect(pupils).toHaveLength(3);
    expect(pupils[0]).toMatchObject({
      upn: "UPI-001",
      firstName: "Ada",
      lastName: "Lovelace",
      yearGroup: 8,
      registrationGroup: "8A",
      wondeId: "WS1",
    });
    // "Year 9" name parses to year group 9.
    expect(pupils[1]?.yearGroup).toBe(9);
  });

  it("propagates source changes on re-sync", async () => {
    const school = fixtureSchool();
    school.students[0]!.surname = "Lovelace-Byron";
    const changed = new WondeClient(new FakeWondeTransport(SCHOOL_ID, school));

    await syncStudents(changed, tenant);
    const pupil = await systemDb.pupil.findUnique({
      where: { tenantId_wondeId: { tenantId: tenant.id, wondeId: "WS1" } },
    });
    expect(pupil?.lastName).toBe("Lovelace-Byron");

    await syncStudents(client, tenant); // restore
  });

  it("ingests a student with no date of birth (sandbox/MIS omits it)", async () => {
    // The Wonde sandbox returns date_of_birth: null for every pupil; DOB is
    // optional, so the pupil must still be created (not skipped).
    const noDobSchoolId = `A${run}-nodob`;
    const noDobTenant = await systemDb.tenant.create({
      data: {
        name: `No-DOB ${run}`,
        slug: `wonde-nodob-${run}`,
        wondeSchoolId: noDobSchoolId,
      },
    });
    const school = fixtureSchool();
    school.students = [
      {
        id: "WSND1",
        upi: `UPI-ND-${run}`,
        forename: "Nora",
        surname: "Doe",
        date_of_birth: null,
        year: { data: { code: 7 } },
      },
    ];
    const noDobClient = new WondeClient(new FakeWondeTransport(noDobSchoolId, school));

    try {
      const stats = await syncStudents(noDobClient, noDobTenant);
      expect(stats).toEqual({ created: 1, updated: 0, skipped: 0 });
      const pupil = await systemDb.pupil.findUnique({
        where: { tenantId_wondeId: { tenantId: noDobTenant.id, wondeId: "WSND1" } },
      });
      expect(pupil?.dateOfBirth).toBeNull();
      expect(pupil?.yearGroup).toBe(7);
    } finally {
      await systemDb.pupil.deleteMany({ where: { tenantId: noDobTenant.id } });
      await systemDb.tenant.delete({ where: { id: noDobTenant.id } });
    }
  });
});

describe("syncAttendance", () => {
  it("is idempotent and skips unknown pupils", async () => {
    const first = await syncAttendance(client, tenant);
    expect(first).toEqual({ created: 3, updated: 0, skipped: 1 });

    const second = await syncAttendance(client, tenant);
    expect(second).toEqual({ created: 0, updated: 3, skipped: 1 });

    const records = await systemDb.attendanceRecord.findMany({
      where: { tenantId: tenant.id },
    });
    expect(records).toHaveLength(3);
    const unauthorised = records.find((r) => r.sourceId === "WA2");
    expect(unauthorised).toMatchObject({
      code: "O",
      present: false,
      authorised: false,
      session: "PM",
    });
  });
});

describe("syncBehaviour", () => {
  it("creates one incident row per involved pupil, idempotently", async () => {
    const first = await syncBehaviour(client, tenant);
    expect(first).toEqual({ created: 3, updated: 0, skipped: 0 });

    const second = await syncBehaviour(client, tenant);
    expect(second).toEqual({ created: 0, updated: 3, skipped: 0 });

    const incidents = await systemDb.behaviourIncident.findMany({
      where: { tenantId: tenant.id },
      orderBy: { sourceId: "asc" },
    });
    expect(incidents.map((i) => i.sourceId)).toEqual([
      "WB1:WS1",
      "WB1:WS2",
      "WB2:WS3",
    ]);
    expect(incidents[2]).toMatchObject({ category: "defiance", severity: 3 });
  });
});

describe("syncAttainment", () => {
  it("maps results idempotently, including numeric strings", async () => {
    const first = await syncAttainment(client, tenant);
    expect(first).toEqual({ created: 2, updated: 0, skipped: 0 });

    const second = await syncAttainment(client, tenant);
    expect(second).toEqual({ created: 0, updated: 2, skipped: 0 });

    const results = await systemDb.attainmentRecord.findMany({
      where: { tenantId: tenant.id },
      orderBy: { sourceId: "asc" },
    });
    expect(results[0]).toMatchObject({ subject: "Maths", score: 72 });
    expect(results[1]).toMatchObject({ subject: "English", score: 58 });
  });
});

describe("runSync", () => {
  it("refuses tenants that are not linked to a Wonde school", async () => {
    const unlinked = await systemDb.tenant.create({
      data: { name: `Unlinked ${run}`, slug: `unlinked-${run}` },
    });
    await expect(
      runSync(client, "STUDENTS", unlinked.id),
    ).rejects.toThrow(/not linked to a Wonde school/);
    await systemDb.tenant.delete({ where: { id: unlinked.id } });
  });
});
