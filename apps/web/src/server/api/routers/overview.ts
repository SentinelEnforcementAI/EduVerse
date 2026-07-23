import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb, type TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import { escalationLevel, type EscalationLevel } from "@/server/escalation";
import { sealPupilRef } from "@/server/identity";

type LevelCounts = Record<EscalationLevel, number>;

function emptyLevels(): LevelCounts {
  return { 1: 0, 2: 0, 3: 0, 4: 0 };
}

function addLevels(a: LevelCounts, b: LevelCounts): LevelCounts {
  return { 1: a[1] + b[1], 2: a[2] + b[2], 3: a[3] + b[3], 4: a[4] + b[4] };
}

// A proportionate risk band for a school, derived from its live caseload: any
// statutory-threshold concern reads HIGH, any targeted-support concern MEDIUM,
// otherwise LOW. A risk band, not a score, and always shown with its label.
export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

function riskBandFor(byLevel: LevelCounts): RiskBand {
  if (byLevel[4] > 0) return "HIGH";
  if (byLevel[3] > 0) return "MEDIUM";
  return "LOW";
}

// Bucket a set of dates into the last `months` calendar months, oldest first.
// Used for the honest behaviour-volume sparkline — real data, never invented.
const TREND_MONTHS = 12;

function monthlyTrend(dates: Date[], months = TREND_MONTHS): number[] {
  const now = new Date();
  const keys: string[] = [];
  const index = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    index.set(key, keys.length);
    keys.push(key);
  }
  const series = new Array<number>(months).fill(0);
  for (const date of dates) {
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const pos = index.get(key);
    if (pos !== undefined) series[pos]!++;
  }
  return series;
}

function trendDelta(series: number[]): number {
  if (series.length < 2) return 0;
  return series[series.length - 1]! - series[series.length - 2]!;
}

// Safeguarding metrics for one school, computed from real (synthetic) data —
// pupils on roll and the live signal picture. Nothing here is a hardcoded
// figure: FUNCTIONAL_SPEC section 3 says the demo fakes these numbers and
// production must compute them, so we do. Values start modest until the rules
// engine has run over ingested data (parity build order step 2); the shape is
// correct regardless.
async function schoolMetrics(db: TenantDb) {
  const trendFrom = new Date();
  trendFrom.setMonth(trendFrom.getMonth() - TREND_MONTHS);
  const [pupilsOnRoll, signals, incidents] = await Promise.all([
    db.pupil.count(),
    db.signal.findMany({ select: { status: true, severity: true, serious: true } }),
    // Behaviour-incident dates over the trend window: the source of the honest
    // 12-month volume sparkline. Only the date is read.
    db.behaviourIncident.findMany({
      where: { date: { gte: trendFrom } },
      select: { date: true },
    }),
  ]);
  const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0, ESCALATED: 0 };
  // The escalation-level shape of the live caseload — how many active concerns
  // sit at each proportionate level. This is a risk-banded series, so the UI
  // may colour it (DESIGN.md); it is never a numeric score on a child.
  const byLevel = emptyLevels();
  for (const s of signals) {
    counts[s.status]++;
    if (s.status !== "DISMISSED") {
      byLevel[escalationLevel(s.severity, s.serious)]++;
    }
  }
  const trend = monthlyTrend(incidents.map((i) => i.date));
  return {
    pupilsOnRoll,
    // Active concerns: everything still live for the DSL — open, confirmed
    // and escalated. Dismissed signals are closed, so they are excluded.
    activeConcerns: counts.OPEN + counts.CONFIRMED + counts.ESCALATED,
    awaitingDecision: counts.OPEN,
    reviewed: counts.CONFIRMED + counts.DISMISSED + counts.ESCALATED,
    escalated: counts.ESCALATED,
    byLevel,
    riskBand: riskBandFor(byLevel),
    // Monthly behaviour-incident volume over the last year, and the change
    // from the prior month. Real data; the sparkline never invents a series.
    trend,
    trendDelta: trendDelta(trend),
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
    orderBy: [{ serious: "desc" }, { severity: "desc" }, { updatedAt: "desc" }],
    take: 6,
  });
  return signals.map((signal) => ({
    id: signal.id,
    ref: sealPupilRef(signal.pupil.upn),
    yearGroup: signal.pupil.yearGroup,
    headline: signal.title,
    level: escalationLevel(signal.severity, signal.serious),
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

  // Lightweight badge counts for the shell nav: active concerns, and alerts
  // (active concerns at the action threshold — level 3 or 4). Chrome, not a
  // record read of a child, so it is deliberately NOT audited. Summed across
  // the caller's schools through each school's own RLS context.
  counts: tenancyProcedure.query(async ({ ctx }) => {
    const activeStatus = ["OPEN", "CONFIRMED", "ESCALATED"] as const;
    let concerns = 0;
    let alerts = 0;
    for (const s of ctx.tenancy.schools) {
      const { db } = dbForSchool(ctx.tenancy, s.id);
      const [c, a] = await Promise.all([
        db.signal.count({ where: { status: { in: [...activeStatus] } } }),
        db.signal.count({
          where: {
            status: { in: [...activeStatus] },
            OR: [{ severity: { gte: 3 } }, { serious: true }],
          },
        }),
      ]);
      concerns += c;
      alerts += a;
    }
    return { concerns, alerts };
  }),

  // The alerts inbox: active concerns at the action threshold (level 3 or 4)
  // across the caller's scope, most urgent first. Sealed — a ref, a level, a
  // one-line reason and the school, never a name. Chrome-level summary of the
  // caseload; the case file itself audits on open.
  alerts: tenancyProcedure.query(async ({ ctx }) => {
    const rows = await Promise.all(
      ctx.tenancy.schools.map(async (s) => {
        const { db } = dbForSchool(ctx.tenancy, s.id);
        const signals = await db.signal.findMany({
          where: {
            status: { in: ["OPEN", "CONFIRMED", "ESCALATED"] },
            OR: [{ severity: { gte: 3 } }, { serious: true }],
          },
          include: { pupil: { select: { upn: true, yearGroup: true } } },
          orderBy: [{ serious: "desc" }, { severity: "desc" }, { updatedAt: "desc" }],
          take: 50,
        });
        return signals.map((sig) => ({
          id: sig.id,
          schoolId: s.id,
          schoolName: s.name,
          ref: sealPupilRef(sig.pupil.upn),
          yearGroup: sig.pupil.yearGroup,
          headline: sig.title,
          level: escalationLevel(sig.severity, sig.serious),
          windowEnd: sig.windowEnd,
        }));
      }),
    );
    const alerts = rows
      .flat()
      .sort((a, b) => b.level - a.level || +b.windowEnd - +a.windowEnd);
    return { alerts };
  }),

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
          byLevel: metrics.byLevel,
          riskBand: metrics.riskBand,
          trend: metrics.trend,
        };
      }),
    );

    const rollup = schools.reduce(
      (acc, s) => ({
        pupilsOnRoll: acc.pupilsOnRoll + s.pupilsOnRoll,
        activeConcerns: acc.activeConcerns + s.activeConcerns,
        awaitingDecision: acc.awaitingDecision + s.awaitingDecision,
        byLevel: addLevels(acc.byLevel, s.byLevel),
        // Trust-wide behaviour trend: the schools' monthly series summed.
        trend: acc.trend.map((n, i) => n + (s.trend[i] ?? 0)),
      }),
      {
        pupilsOnRoll: 0,
        activeConcerns: 0,
        awaitingDecision: 0,
        byLevel: emptyLevels(),
        trend: new Array<number>(TREND_MONTHS).fill(0),
      },
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
