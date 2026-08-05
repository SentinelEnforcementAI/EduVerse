import { TRPCError } from "@trpc/server";

import type { TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import {
  buildInsights,
  type InsightPupil,
  type InsightSignal,
} from "@/server/insights";

// Trust safeguarding analytics for the head of safeguarding (spec 5.1/5.3): the
// caseload as trends and cohorts, not a wall of flags. Director-only, read from
// each school through its own RLS context and summed in application code — there
// is no cross-tenant query. Counts and rates only; never a pupil by name.

async function schoolData(
  db: TenantDb,
): Promise<{ pupils: InsightPupil[]; signals: InsightSignal[] }> {
  const [pupils, rawSignals] = await Promise.all([
    db.pupil.findMany({
      select: {
        id: true,
        yearGroup: true,
        pupilPremium: true,
        freeSchoolMeals: true,
        senStatus: true,
        eal: true,
        lookedAfter: true,
        youngCarer: true,
        serviceChild: true,
      },
    }),
    db.signal.findMany({
      select: {
        pupilId: true,
        status: true,
        severity: true,
        serious: true,
        windowEnd: true,
        ruleVersion: { select: { key: true } },
      },
      take: 5000,
    }),
  ]);

  const signals: InsightSignal[] = rawSignals.map((s) => ({
    pupilId: s.pupilId,
    status: s.status,
    severity: s.severity,
    serious: s.serious,
    windowEnd: s.windowEnd,
    ruleKey: s.ruleVersion.key,
  }));
  return { pupils, signals };
}

export const insightsRouter = createTRPCRouter({
  // The whole-trust analytics payload. Director / head of safeguarding only.
  trust: tenancyProcedure.query(async ({ ctx }) => {
    if (ctx.tenancy.mode !== "mat" || !ctx.tenancy.trustId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Trust insights are available to trust leadership only.",
      });
    }

    const schools = await Promise.all(
      ctx.tenancy.schools.map(async (s) => {
        const { db } = dbForSchool(ctx.tenancy, s.id);
        const { pupils, signals } = await schoolData(db);
        return { name: s.name, pupils, signals };
      }),
    );

    return buildInsights(schools, new Date());
  }),
});
