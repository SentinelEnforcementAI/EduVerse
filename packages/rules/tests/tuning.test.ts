import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { dbForTenant, systemDb, type Tenant } from "@sentinel/db";

import { effectiveParamsForTenant, runRulesForTenant } from "../src/engine";
import { attendanceDrop } from "../src/rules/attendance-drop";
import type { RuleContext } from "../src/types";

// Per-trust rule tuning (commercialisation slice 7): a trust's RuleConfig
// override changes the effective thresholds the engine uses, the tuned params
// flow into evaluate() and change what fires, and the effective thresholds are
// recorded on the run so it stays auditable.

const run = randomUUID().slice(0, 8);
const AS_OF = new Date(Date.UTC(2026, 6, 21));

let trustId: string;
let school: Tenant;
let ctx: RuleContext;
let dropPupilId: string;

function* weekdaysBetween(from: Date, to: Date): Generator<Date> {
  for (let t = from.getTime(); t < to.getTime(); t += 86_400_000) {
    const d = new Date(t);
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) yield d;
  }
}
const daysAgo = (n: number) => new Date(AS_OF.getTime() - n * 86_400_000);

async function addAttendance(
  pupilId: string,
  fromDaysAgo: number,
  toDaysAgo: number,
  isAbsent: (i: number) => boolean,
) {
  const rows = [];
  let i = 0;
  for (const date of weekdaysBetween(daysAgo(fromDaysAgo), daysAgo(toDaysAgo))) {
    const absent = isAbsent(i++);
    for (const session of ["AM", "PM"] as const) {
      rows.push({
        tenantId: school.id,
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
  const trust = await systemDb.trust.create({
    data: { name: `Tune Trust ${run}`, slug: `tune-${run}` },
  });
  trustId = trust.id;
  school = await systemDb.tenant.create({
    data: { name: `Tune School ${run}`, slug: `tune-s-${run}`, trustId },
  });
  ctx = { tenantId: school.id, asOf: AS_OF, db: dbForTenant(school.id) };

  const pupil = await systemDb.pupil.create({
    data: {
      tenantId: school.id,
      upn: `TUNE-${run}`,
      firstName: "Drop",
      lastName: "Fixture",
      yearGroup: 9,
      registrationGroup: "9A",
      dateOfBirth: new Date(Date.UTC(2011, 0, 1)),
    },
  });
  dropPupilId = pupil.id;
  // Baseline near-perfect; recent ~50% — a 50pp drop.
  await addAttendance(dropPupilId, 112, 28, () => false);
  await addAttendance(dropPupilId, 28, 0, (i) => i % 2 === 0);
});

afterAll(async () => {
  await systemDb.signal.deleteMany({ where: { tenantId: school.id } });
  await systemDb.ruleExecution.deleteMany({ where: { tenantId: school.id } });
  await systemDb.ruleConfig.deleteMany({ where: { trustId } });
  await systemDb.pupil.deleteMany({ where: { tenantId: school.id } });
  await systemDb.tenant.deleteMany({ where: { id: school.id } });
  await systemDb.trust.deleteMany({ where: { id: trustId } });
});

describe("effective params", () => {
  it("merges a trust override over the rule defaults (partial)", async () => {
    await systemDb.ruleConfig.create({
      data: {
        trustId,
        ruleKey: "attendance-drop",
        params: { minDropPercentagePoints: 60 },
      },
    });

    const effective = await effectiveParamsForTenant(school.id);
    const p = effective.get("attendance-drop")!;
    expect(p.minDropPercentagePoints).toBe(60); // overridden
    expect(p.recentDays).toBe(attendanceDrop.params.recentDays); // default kept
  });
});

describe("tuning changes what fires", () => {
  it("the tuned threshold flows into evaluate and suppresses a below-threshold drop", async () => {
    // The 50pp drop fires at the default threshold …
    const atDefault = await attendanceDrop.evaluate(ctx);
    expect(atDefault.some((r) => r.pupilId === dropPupilId)).toBe(true);

    // … but a 60pp threshold (as tuned above) suppresses it.
    const tuned = await attendanceDrop.evaluate(ctx, {
      ...attendanceDrop.params,
      minDropPercentagePoints: 60,
    });
    expect(tuned.some((r) => r.pupilId === dropPupilId)).toBe(false);
  });

  it("records the effective (tuned) thresholds on the run", async () => {
    const result = await runRulesForTenant(school.id, AS_OF);
    expect(result.stats["attendance-drop"]!.params.minDropPercentagePoints).toBe(60);
  });
});
