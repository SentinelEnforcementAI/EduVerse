import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { type Tenancy, type TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { deriveComponents, STATUS_LABEL } from "@/server/compliance/kcsie";

function schoolFor(tenancy: Tenancy, schoolId: string | undefined) {
  const resolved =
    schoolId ?? (tenancy.mode === "school" ? tenancy.schools[0]?.id : undefined);
  if (!resolved) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a school." });
  }
  return dbForSchool(tenancy, resolved);
}

// The golden thread (spec 5.14): policy and training, identification, action,
// and assurance. Each strand is counted from real records so a school can
// evidence the full thread to an inspector.
async function goldenThread(db: TenantDb) {
  const [orgDocs, signalCounts, referrals, caseDocs, auditCount] =
    await Promise.all([
      db.document.findMany({
        where: { scope: "ORG" },
        select: {
          type: true,
          title: true,
          themes: true,
          docDate: true,
          status: true,
          content: true,
          summary: true,
        },
      }),
      db.signal.groupBy({ by: ["status"], _count: { _all: true } }),
      db.referral.count(),
      db.document.count({ where: { scope: "CASE" } }),
      db.auditEvent.count(),
    ]);

  const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0, ESCALATED: 0 };
  for (const row of signalCounts) counts[row.status] = row._count._all;
  const { overall } = deriveComponents(orgDocs, new Date());

  return {
    compliance: { overall, overallLabel: STATUS_LABEL[overall] },
    identification: {
      surfaced: counts.OPEN + counts.CONFIRMED + counts.DISMISSED + counts.ESCALATED,
      active: counts.OPEN + counts.CONFIRMED + counts.ESCALATED,
      reviewed: counts.CONFIRMED + counts.DISMISSED + counts.ESCALATED,
    },
    action: { referrals, caseDocuments: caseDocs },
    assurance: { policies: orgDocs.length, auditEntries: auditCount },
  };
}

export const inspectionRouter = createTRPCRouter({
  // Inspection readiness at school scope (spec 5.14).
  school: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const thread = await goldenThread(db);
      return { schoolId: school.id, schoolName: school.name, thread };
    }),

  // Inspection readiness at trust scope (spec 5.14): the thread rolled up.
  trust: tenancyProcedure.query(async ({ ctx }) => {
    if (ctx.tenancy.mode !== "mat") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const threads = await Promise.all(
      ctx.tenancy.schools.map(async (s) => {
        const { db } = dbForSchool(ctx.tenancy, s.id);
        return { school: s, thread: await goldenThread(db) };
      }),
    );
    const rollup = threads.reduce(
      (acc, { thread }) => ({
        surfaced: acc.surfaced + thread.identification.surfaced,
        active: acc.active + thread.identification.active,
        referrals: acc.referrals + thread.action.referrals,
        auditEntries: acc.auditEntries + thread.assurance.auditEntries,
      }),
      { surfaced: 0, active: 0, referrals: 0, auditEntries: 0 },
    );
    return {
      schools: threads.map(({ school, thread }) => ({
        id: school.id,
        name: school.name,
        complianceLabel: thread.compliance.overallLabel,
        active: thread.identification.active,
      })),
      rollup,
    };
  }),
});
