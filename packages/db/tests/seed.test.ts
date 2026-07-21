import { describe, expect, it } from "vitest";

import { seedDatabase } from "../prisma/seed";
import { dbForTenant, systemDb } from "../src";
import { schoolDays } from "../src/synthetic/generator";

// Smoke test: a small seed run against the real database, proving the seed
// is idempotent and that pupil data respects tenant isolation end to end.

const OPTIONS = {
  pupilsPerSchool: 25,
  months: 2,
  anchorDate: new Date(Date.UTC(2026, 6, 21)),
};

describe("seedDatabase", () => {
  it("seeds both schools and is idempotent on re-run", async () => {
    await seedDatabase(OPTIONS);
    const summary = await seedDatabase(OPTIONS);

    expect(summary.schools.map((s) => s.slug)).toEqual([
      "downlands",
      "patcham",
    ]);

    const sessionCount = schoolDays(OPTIONS.anchorDate, OPTIONS.months).length * 2;
    for (const school of summary.schools) {
      const pupils = await systemDb.pupil.count({
        where: { tenantId: school.tenantId },
      });
      const attendance = await systemDb.attendanceRecord.count({
        where: { tenantId: school.tenantId },
      });
      expect(pupils).toBe(OPTIONS.pupilsPerSchool);
      expect(attendance).toBe(OPTIONS.pupilsPerSchool * sessionCount);

      const dsl = await systemDb.user.findUnique({
        where: { email: `dsl@${school.slug}.example` },
      });
      expect(dsl?.tenantId).toBe(school.tenantId);
    }
  }, 60_000);

  it("pupil data is tenant-isolated under RLS", async () => {
    const [downlands, patcham] = (await seedDatabase(OPTIONS)).schools;

    const seen = await dbForTenant(downlands!.tenantId).pupil.findMany({
      select: { upn: true },
    });
    expect(seen).toHaveLength(OPTIONS.pupilsPerSchool);
    expect(seen.every((p) => p.upn.startsWith("SW-DOW"))).toBe(true);

    // Cross-tenant: Patcham context sees none of Downlands' records.
    const patchamView = dbForTenant(patcham!.tenantId);
    expect(
      await patchamView.pupil.count({
        where: { tenantId: downlands!.tenantId },
      }),
    ).toBe(0);
    expect(
      await patchamView.attendanceRecord.count({
        where: { tenantId: downlands!.tenantId },
      }),
    ).toBe(0);
    expect(
      await patchamView.behaviourIncident.count({
        where: { tenantId: downlands!.tenantId },
      }),
    ).toBe(0);
    expect(
      await patchamView.attainmentRecord.count({
        where: { tenantId: downlands!.tenantId },
      }),
    ).toBe(0);
  }, 60_000);
});
