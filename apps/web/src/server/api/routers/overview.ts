import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb, type TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import { sealPupilRef } from "@/server/identity";

// Safeguarding metrics for one school, computed from real (synthetic) data —
// pupils on roll and the live signal picture. Nothing here is a hardcoded
// figure: FUNCTIONAL_SPEC section 3 says the demo fakes these numbers and
// production must compute them, so we do. Values start modest until the rules
// engine has run over ingested data (parity build order step 2); the shape is
// correct regardless.
async function schoolMetrics(db: TenantDb) {
  const [pupilsOnRoll, grouped] = await Promise.all([
    db.pupil.count(),
    db.signal.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0, ESCALATED: 0 };
  for (const row of grouped) counts[row.status] = row._count._all;
  return {
    pupilsOnRoll,
    // Active concerns: everything still live for the DSL — open, confirmed
    // and escalated. Dismissed signals are closed, so they are excluded.
    activeConcerns: counts.OPEN + counts.CONFIRMED + counts.ESCALATED,
    awaitingDecision: counts.OPEN,
    reviewed: counts.CONFIRMED + counts.DISMISSED + counts.ESCALATED,
    escalated: counts.ESCALATED,
  };
}

// The current pattern list for a school: open signals a DSL should look at,
// most severe first. Identity is sealed by default (spec principle 2) — the
// pupil never appears by name here, only as a stable sealed reference. The
// numeric severity is deliberately NOT returned: no risk score on a child
// (principle 4). The escalation-level treatment lands with the case-view slice.
async function schoolPatterns(db: TenantDb) {
  const signals = await db.signal.findMany({
    where: { status: "OPEN" },
    include: { pupil: { select: { upn: true, yearGroup: true } } },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take: 6,
  });
  return signals.map((signal) => ({
    id: signal.id,
    ref: sealPupilRef(signal.pupil.upn),
    yearGroup: signal.pupil.yearGroup,
    headline: signal.title,
    windowEnd: signal.windowEnd,
  }));
}

export const overviewRouter = createTRPCRouter({
  // Which tenancy mode the caller is in and the schools they can reach. Drives
  // the shell (role selector, header, drill-down) without leaking any data.
  tenancy: tenancyProcedure.query(({ ctx }) => ({
    mode: ctx.tenancy.mode,
    trustId: ctx.tenancy.trustId,
    schools: ctx.tenancy.schools.map((s) => ({ id: s.id, name: s.name })),
  })),

  // A single school's overview (spec 5.2). Works for a DSL (their own school)
  // and for a director drilling into any school of their trust.
  school: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const schoolId = input.schoolId ?? ctx.tenancy.schools[0]?.id;
      if (!schoolId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (!input.schoolId && ctx.tenancy.schools.length > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a school to view.",
        });
      }
      const { school, db } = dbForSchool(ctx.tenancy, schoolId);
      const [metrics, patterns] = await Promise.all([
        schoolMetrics(db),
        schoolPatterns(db),
      ]);

      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "school.overview.viewed",
        entityType: "school",
        entityId: school.id,
      });

      return { school: { id: school.id, name: school.name }, metrics, patterns };
    }),

  // The trust overview (spec 5.1): a director's rollup across every school in
  // their trust, each row drilling into that school's overview. Reads each
  // school through its own RLS context and sums in application code — there is
  // no cross-tenant query. Director-only.
  trust: tenancyProcedure.query(async ({ ctx }) => {
    if (ctx.tenancy.mode !== "mat" || !ctx.tenancy.trustId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Trust overview is available to trust directors only.",
      });
    }

    const schools = await Promise.all(
      ctx.tenancy.schools.map(async (s) => {
        const { db } = dbForSchool(ctx.tenancy, s.id);
        const [metrics, dsl] = await Promise.all([
          schoolMetrics(db),
          db.user.findFirst({
            where: { role: "DSL" },
            select: { name: true },
            orderBy: { createdAt: "asc" },
          }),
        ]);
        await recordAuditEvent(db, {
          tenantId: s.id,
          userId: ctx.session.user.id,
          action: "trust.overview.viewed",
          entityType: "school",
          entityId: s.id,
        });
        return {
          id: s.id,
          name: s.name,
          dsl: dsl?.name ?? null,
          pupilsOnRoll: metrics.pupilsOnRoll,
          activeConcerns: metrics.activeConcerns,
          awaitingDecision: metrics.awaitingDecision,
        };
      }),
    );

    const rollup = schools.reduce(
      (acc, s) => ({
        pupilsOnRoll: acc.pupilsOnRoll + s.pupilsOnRoll,
        activeConcerns: acc.activeConcerns + s.activeConcerns,
        awaitingDecision: acc.awaitingDecision + s.awaitingDecision,
      }),
      { pupilsOnRoll: 0, activeConcerns: 0, awaitingDecision: 0 },
    );

    // The director's own trust name, for the heading and the report. Read
    // under the system context filtered to their trust — no cross-trust path.
    const trust = await systemDb.trust.findUnique({
      where: { id: ctx.tenancy.trustId },
      select: { name: true },
    });

    return {
      trustId: ctx.tenancy.trustId,
      trustName: trust?.name ?? "Trust",
      metrics: { schools: schools.length, ...rollup },
      schools,
    };
  }),
});
