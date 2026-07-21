import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb, type Tenant } from "@sentinel/db";

import { attendanceDrop } from "../src/rules/attendance-drop";
import { attainmentDecline } from "../src/rules/attainment-decline";
import { behaviourSpike } from "../src/rules/behaviour-spike";
import { crossDomain } from "../src/rules/cross-domain";
import { sustainedAbsence } from "../src/rules/sustained-absence";
import type { RuleContext } from "../src/types";

// Unit tests for every rule (mandatory): each rule gets a hand-built pupil
// designed to fire it and a healthy pupil that must not fire. Fixtures are
// written through the real database, so RLS and query shapes are exercised
// for real, not mocked.

const run = randomUUID().slice(0, 8);
const AS_OF = new Date(Date.UTC(2026, 6, 21)); // a Tuesday

let tenant: Tenant;
let ctx: RuleContext;

function* weekdaysBetween(from: Date, to: Date): Generator<Date> {
  for (let t = from.getTime(); t < to.getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) yield d;
  }
}

function daysAgo(days: number): Date {
  return new Date(AS_OF.getTime() - days * 86_400_000);
}

async function makePupil(name: string): Promise<string> {
  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: tenant.id,
      upn: `RT-${run}-${name}`,
      firstName: name,
      lastName: "Fixture",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  return pupil.id;
}

// Writes AM+PM rows for every weekday in [fromDaysAgo, toDaysAgo) with a
// per-day absence decider.
async function addAttendance(
  pupilId: string,
  fromDaysAgo: number,
  toDaysAgo: number,
  isAbsent: (date: Date, index: number) => boolean,
): Promise<void> {
  const rows = [];
  let index = 0;
  for (const date of weekdaysBetween(daysAgo(fromDaysAgo), daysAgo(toDaysAgo))) {
    const absent = isAbsent(date, index++);
    for (const session of ["AM", "PM"] as const) {
      rows.push({
        tenantId: tenant.id,
        pupilId,
        date,
        session,
        code: absent ? "O" : "/",
        present: !absent,
        authorised: !absent,
      });
    }
  }
  await systemDb.attendanceRecord.createMany({ data: rows });
}

beforeAll(async () => {
  tenant = await systemDb.tenant.create({
    data: { name: `Rules Test ${run}`, slug: `rules-test-${run}` },
  });
  ctx = { tenantId: tenant.id, asOf: AS_OF, db: dbForTenant(tenant.id) };
});

afterAll(async () => {
  await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });
  await systemDb.tenant.delete({ where: { id: tenant.id } });
});

describe("attendance-drop", () => {
  it("fires on a sharp drop against baseline, with explainable reasoning", async () => {
    const dropping = await makePupil("Drop");
    const steady = await makePupil("Steady");
    // Baseline (112→28 days ago): near-perfect. Recent 28 days: ~43% absent.
    await addAttendance(dropping, 112, 28, () => false);
    await addAttendance(dropping, 28, 0, (_d, i) => i % 7 < 3);
    await addAttendance(steady, 112, 0, (_d, i) => i % 20 === 0);

    const results = await attendanceDrop.evaluate(ctx);
    const fired = results.filter((r) => [dropping, steady].includes(r.pupilId));
    expect(fired.map((r) => r.pupilId)).toEqual([dropping]);
    expect(fired[0]!.severity).toBe(3);
    expect(fired[0]!.reasoning.metrics.dropPercentagePoints).toBeGreaterThan(30);
    expect(fired[0]!.reasoning.summary).toContain("percentage points");
    expect(fired[0]!.reasoning.dataPoints.length).toBeGreaterThan(0);
  });
});

describe("sustained-absence", () => {
  it("fires on a habitual same-weekday pattern, not on general absence", async () => {
    const monday = await makePupil("Monday");
    const scattered = await makePupil("Scattered");
    // Mondays absent ~always, everything else present.
    await addAttendance(monday, 84, 0, (d) => d.getUTCDay() === 1);
    // Similar absence volume but rotating across weekdays — must NOT fire.
    // (Note: % 5 would land on the same weekday every time; 7 rotates.)
    await addAttendance(scattered, 84, 0, (_d, i) => i % 7 === 0);

    const results = await sustainedAbsence.evaluate(ctx);
    const fired = results.filter((r) => [monday, scattered].includes(r.pupilId));
    expect(fired.map((r) => r.pupilId)).toEqual([monday]);
    expect(fired[0]!.reasoning.metrics.weekday).toBe("Monday");
    expect(fired[0]!.title).toMatch(/Mondays/);
  });
});

describe("behaviour-spike", () => {
  it("fires on a recent cluster, not on a steady low rate", async () => {
    const spiking = await makePupil("Spike");
    const steady = await makePupil("Calm");
    const incident = (pupilId: string, dayAgo: number, severity: number) => ({
      tenantId: tenant.id,
      pupilId,
      date: daysAgo(dayAgo),
      category: "disruption",
      severity,
      description: "Fixture incident",
    });
    await systemDb.behaviourIncident.createMany({
      data: [
        // Spiking: 6 incidents inside 30 days, 1 before.
        incident(spiking, 2, 3),
        incident(spiking, 5, 2),
        incident(spiking, 9, 2),
        incident(spiking, 14, 3),
        incident(spiking, 20, 2),
        incident(spiking, 26, 2),
        incident(spiking, 70, 1),
        // Calm: 2 spread out.
        incident(steady, 10, 1),
        incident(steady, 80, 1),
      ],
    });

    const results = await behaviourSpike.evaluate(ctx);
    const fired = results.filter((r) => [spiking, steady].includes(r.pupilId));
    expect(fired.map((r) => r.pupilId)).toEqual([spiking]);
    expect(fired[0]!.severity).toBe(3); // severity-weighted total 14
    expect(fired[0]!.reasoning.metrics.recentIncidents).toBe(6);
    expect(fired[0]!.reasoning.dataPoints).toHaveLength(6);
  });
});

describe("attainment-decline", () => {
  it("fires on broad decline, not a single-subject dip", async () => {
    const declining = await makePupil("Decline");
    const oneOff = await makePupil("OneOff");
    const record = (pupilId: string, subject: string, monthsAgo: number, score: number) => ({
      tenantId: tenant.id,
      pupilId,
      subject,
      assessedAt: daysAgo(monthsAgo * 30),
      score,
    });
    await systemDb.attainmentRecord.createMany({
      data: [
        record(declining, "English", 10, 70), record(declining, "English", 1, 52),
        record(declining, "Maths", 10, 65), record(declining, "Maths", 1, 50),
        record(declining, "Science", 10, 60), record(declining, "Science", 1, 58),
        record(oneOff, "English", 10, 70), record(oneOff, "English", 1, 71),
        record(oneOff, "Maths", 10, 68), record(oneOff, "Maths", 1, 55),
        record(oneOff, "Science", 10, 62), record(oneOff, "Science", 1, 63),
      ],
    });

    const results = await attainmentDecline.evaluate(ctx);
    const fired = results.filter((r) => [declining, oneOff].includes(r.pupilId));
    expect(fired.map((r) => r.pupilId)).toEqual([declining]);
    expect(fired[0]!.reasoning.metrics.subjectsDeclining).toBe(2);
    expect(fired[0]!.severity).toBe(2); // average decline 16.5
  });
});

describe("cross-domain", () => {
  it("fires when moderate deterioration spans domains, each below its own threshold", async () => {
    const drifting = await makePupil("Drift");
    // Attendance: ~11pp drop — below attendance-drop's 15pp threshold.
    await addAttendance(drifting, 112, 28, () => false);
    await addAttendance(drifting, 28, 0, (_d, i) => i % 10 === 0);
    // Behaviour: 3 recent incidents — below behaviour-spike's 4.
    await systemDb.behaviourIncident.createMany({
      data: [3, 12, 24].map((dayAgo) => ({
        tenantId: tenant.id,
        pupilId: drifting,
        date: daysAgo(dayAgo),
        category: "defiance",
        severity: 2,
        description: "Fixture incident",
      })),
    });
    // Attainment: ~6 point average decline — below attainment-decline's 8.
    await systemDb.attainmentRecord.createMany({
      data: [
        { tenantId: tenant.id, pupilId: drifting, subject: "English", assessedAt: daysAgo(300), score: 66 },
        { tenantId: tenant.id, pupilId: drifting, subject: "English", assessedAt: daysAgo(30), score: 60 },
        { tenantId: tenant.id, pupilId: drifting, subject: "Maths", assessedAt: daysAgo(300), score: 70 },
        { tenantId: tenant.id, pupilId: drifting, subject: "Maths", assessedAt: daysAgo(30), score: 64 },
      ],
    });

    const [attendanceResults, behaviourResults, attainmentResults, crossResults] =
      await Promise.all([
        attendanceDrop.evaluate(ctx),
        behaviourSpike.evaluate(ctx),
        attainmentDecline.evaluate(ctx),
        crossDomain.evaluate(ctx),
      ]);

    // No single-domain rule catches this pupil…
    expect(attendanceResults.map((r) => r.pupilId)).not.toContain(drifting);
    expect(behaviourResults.map((r) => r.pupilId)).not.toContain(drifting);
    expect(attainmentResults.map((r) => r.pupilId)).not.toContain(drifting);

    // …but the correlation rule does, across all three domains.
    const fired = crossResults.find((r) => r.pupilId === drifting);
    expect(fired).toBeDefined();
    expect(fired!.reasoning.metrics.domainsAffected).toBe(3);
    expect(fired!.severity).toBe(3);
  });
});
