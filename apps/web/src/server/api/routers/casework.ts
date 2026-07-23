import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { SignalStatus, TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import {
  confidenceBand,
  escalationLevel,
  LEVEL_META,
  sourceForRule,
} from "@/server/escalation";
import { sealPupilRef } from "@/server/identity";

// The triage keys that map to a real, honest filter over signal status. The
// demo has more (flagged this week, MASH) that depend on features not yet
// built; only filters backed by real data are offered — no dead tabs.
const TRIAGE_KEYS = ["active", "awaiting"] as const;
type TriageKey = (typeof TRIAGE_KEYS)[number];

export const TRIAGE_META: Record<
  TriageKey,
  { title: string; subtitle: string; statuses: SignalStatus[] }
> = {
  active: {
    title: "Active concerns",
    subtitle:
      "Every live pattern Watch has surfaced, highest priority first. Dismissed flags are closed and excluded.",
    statuses: ["OPEN", "CONFIRMED", "ESCALATED"],
  },
  awaiting: {
    title: "Awaiting a decision",
    subtitle: "Patterns that need a DSL decision now, highest priority first.",
    statuses: ["OPEN"],
  },
};

type SignalReasoning = {
  summary: string;
  metrics: Record<string, number | string>;
  dataPoints: { label: string; date?: string; value: string | number }[];
};

// A sealed triage row: no name, no numeric severity — a sealed reference, the
// headline, and the proportionate escalation level only.
async function triageRows(
  db: TenantDb,
  school: { id: string; name: string },
  key: TriageKey,
) {
  const signals = await db.signal.findMany({
    where: { status: { in: TRIAGE_META[key].statuses } },
    include: { pupil: { select: { upn: true, yearGroup: true } } },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take: 200,
  });
  return signals.map((signal) => ({
    id: signal.id,
    schoolId: school.id,
    schoolName: school.name,
    ref: sealPupilRef(signal.pupil.upn),
    yearGroup: signal.pupil.yearGroup,
    headline: signal.title,
    level: escalationLevel(signal.severity),
    confidence: confidenceBand(signal.severity),
    status: signal.status,
  }));
}

export const caseworkRouter = createTRPCRouter({
  // Triage list (spec 5.4). Scope is a single school, or the whole trust for a
  // director (the working list behind a trust KPI card). Identity sealed.
  triage: tenancyProcedure
    .input(
      z.object({
        key: z.enum(TRIAGE_KEYS).default("active"),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const meta = TRIAGE_META[input.key];

      // Trust scope: a director with no chosen school sees every school.
      const targets =
        input.schoolId || ctx.tenancy.mode === "school"
          ? [dbForSchool(ctx.tenancy, input.schoolId ?? ctx.tenancy.schools[0]!.id)]
          : ctx.tenancy.schools.map((s) => dbForSchool(ctx.tenancy, s.id));

      const grouped = await Promise.all(
        targets.map(({ school, db }) => triageRows(db, school, input.key)),
      );
      const rows = grouped
        .flat()
        .sort((a, b) => b.level - a.level);

      return {
        scope: input.schoolId || ctx.tenancy.mode === "school" ? "school" : "trust",
        schoolId: input.schoolId ?? null,
        title: meta.title,
        subtitle: meta.subtitle,
        rows,
      };
    }),

  // Read-only case view (spec 5.5). Every explainability surface, identity
  // sealed by default (reveal is gated and lands with the HITL slice). The read
  // is audited against the pupil's record.
  case: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // A DSL is scoped to their one school; a director must name the school.
      const schoolId =
        input.schoolId ??
        (ctx.tenancy.mode === "school" ? ctx.tenancy.schools[0]?.id : undefined);
      if (!schoolId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Choose a school to open this case.",
        });
      }
      const { school, db } = dbForSchool(ctx.tenancy, schoolId);

      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        include: {
          pupil: { select: { id: true, upn: true, yearGroup: true } },
          ruleVersion: { select: { key: true, name: true } },
        },
      });
      if (!signal) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const reasoning = signal.reasoning as SignalReasoning;
      const level = escalationLevel(signal.severity);
      const source = sourceForRule(signal.ruleVersion.key);

      // Time to surface (spec 5.5, method documented): the interval between the
      // first underlying indicator in the window and the point Watch linked the
      // pattern (the window end). This is the honest, defensible MVP figure.
      // CTO-DECISION: the investor-facing "days earlier than manual review"
      // claim needs a defined review cadence per trust; that layers on top.
      const firstDate = reasoning.dataPoints
        .map((p) => p.date)
        .filter((d): d is string => Boolean(d))
        .sort()[0];
      const daysToSurface = firstDate
        ? Math.max(
            0,
            Math.round(
              (signal.windowEnd.getTime() - new Date(firstDate).getTime()) /
                86_400_000,
            ),
          )
        : null;

      // Linked context: the pupil's other open signals — real links only.
      const siblings = await db.signal.findMany({
        where: {
          pupilId: signal.pupilId,
          status: "OPEN",
          id: { not: signal.id },
        },
        select: { id: true, title: true },
        take: 10,
      });

      // Case audit trail: the append-only history for this signal.
      const auditEvents = await db.auditEvent.findMany({
        where: { entityType: "signal", entityId: signal.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "case.viewed",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
      });

      return {
        schoolId: school.id,
        schoolName: school.name,
        ref: sealPupilRef(signal.pupil.upn),
        yearGroup: signal.pupil.yearGroup,
        headline: signal.title,
        status: signal.status,
        confidence: confidenceBand(signal.severity),
        window: { start: signal.windowStart, end: signal.windowEnd },
        daysToSurface,
        escalation: LEVEL_META[level],
        overall: reasoning.summary,
        interpretation: {
          summary: reasoning.summary,
          source,
          rule: signal.ruleVersion.name,
          metrics: reasoning.metrics,
        },
        timeline: reasoning.dataPoints.map((p) => ({
          date: p.date ?? null,
          label: p.label,
          source,
        })),
        linked: siblings.map((s) => ({ id: s.id, headline: s.title })),
        audit: auditEvents.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: e.createdAt,
        })),
      };
    }),
});
