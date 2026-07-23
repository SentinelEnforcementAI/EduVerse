import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemTransaction, type SignalStatus, type TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import {
  confidenceBand,
  escalationLevel,
  isRevealable,
  LEVEL_META,
  sourceForRule,
} from "@/server/escalation";
import { REVEAL_REASONS, sealPupilRef } from "@/server/identity";
import { decideSignal } from "@/server/signals/decide";
import { advise } from "@/server/advisory/advise";
import { COMMS_DRAFT_PROMPT, enhanceComms } from "@/server/advisory/enhance";
import { getNarrativeModel } from "@/server/narrative/model-provider";
import {
  buildDraft,
  COMM_META,
  COMM_TYPES,
  type CaseDraftData,
  type CommType,
} from "@/server/comms/templates";

function ukDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const commTypeEnum = z.enum(COMM_TYPES as [CommType, ...CommType[]]);

// Resolves the school a case action targets: a DSL's single school, or the
// school a director names. Shared by the case query and every mutation.
function resolveSchoolId(
  tenancy: { mode: "school" | "mat"; schools: { id: string }[] },
  schoolId: string | undefined,
): string {
  const resolved =
    schoolId ?? (tenancy.mode === "school" ? tenancy.schools[0]?.id : undefined);
  if (!resolved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a school for this case.",
    });
  }
  return resolved;
}

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

  // On-call (spec 5.16): the out-of-hours view. The highest-priority active
  // cases across the caller's scope (level 3 and above), sealed. A director
  // sees the whole trust; a DSL sees their school.
  onCall: tenancyProcedure.query(async ({ ctx }) => {
    const targets = ctx.tenancy.schools.map((s) => dbForSchool(ctx.tenancy, s.id));
    const grouped = await Promise.all(
      targets.map(({ school, db }) => triageRows(db, school, "active")),
    );
    const rows = grouped
      .flat()
      .filter((r) => r.level >= 3)
      .sort((a, b) => b.level - a.level);
    return { rows };
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
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );

      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        include: {
          // firstName / lastName are read but only ever RETURNED once the case
          // is revealed (below) — never on a sealed case.
          pupil: {
            select: {
              id: true,
              upn: true,
              yearGroup: true,
              firstName: true,
              lastName: true,
            },
          },
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

      // Identity: sealed by default. Revealed only if a reveal has been
      // recorded (an audit event), and only then is the name returned.
      const revealed = auditEvents.some(
        (e) => e.action === "pupil.identity.revealed",
      );
      const revealable = isRevealable(level);

      // Case notes (append-only), the filed documents (spec 5.6), the case
      // file checklist (spec 5.7) and the scheduled reviews (spec 5.8).
      const [notes, documents, tasks, reviews] = await Promise.all([
        db.caseNote.findMany({
          where: { signalId: signal.id },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        db.document.findMany({
          where: { signalId: signal.id, scope: "CASE" },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.caseTask.findMany({
          where: { signalId: signal.id },
          orderBy: { createdAt: "asc" },
        }),
        db.caseReview.findMany({
          where: { signalId: signal.id },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      // Names of everyone referenced (note authors and tags, review attendees
      // and schedulers), resolved from the school's own directory.
      const referencedUserIds = [
        ...new Set([
          ...notes.flatMap((n) => [n.authorId, ...n.taggedUserIds]),
          ...reviews.flatMap((r) => [r.createdById, ...r.attendees]),
        ]),
      ];
      const users = referencedUserIds.length
        ? await db.user.findMany({
            where: { id: { in: referencedUserIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const nameById = new Map(users.map((u) => [u.id, u.name ?? u.email]));

      // Referral lifecycle (spec 5.10): available once the case is serious
      // enough to reveal identity. CTO-DECISION: the demo gates referral at
      // level 4 or serious; here it follows the reveal threshold (level 3+), so
      // a DSL can refer any case serious enough to warrant it.
      const canRefer = isRevealable(level);
      const referral = canRefer
        ? await db.referral.findUnique({ where: { signalId: signal.id } })
        : null;
      const referralEvents = referral
        ? await db.referralEvent.findMany({
            where: { referralId: referral.id },
            orderBy: { createdAt: "asc" },
          })
        : [];

      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "case.viewed",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
      });

      return {
        signalId: signal.id,
        schoolId: school.id,
        schoolName: school.name,
        ref: sealPupilRef(signal.pupil.upn),
        // The name is present ONLY when the case has been revealed; otherwise
        // it never leaves the server.
        pupilName: revealed
          ? `${signal.pupil.firstName} ${signal.pupil.lastName}`
          : null,
        revealed,
        revealable,
        revealReasons: REVEAL_REASONS,
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
        notes: notes.map((n) => ({
          id: n.id,
          body: n.body,
          author: nameById.get(n.authorId) ?? "A colleague",
          tagged: n.taggedUserIds
            .map((id) => nameById.get(id))
            .filter((name): name is string => Boolean(name)),
          createdAt: n.createdAt,
        })),
        documents: documents.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          docDate: d.docDate,
          summary: d.summary,
        })),
        commOptions: COMM_TYPES.map((t) => ({
          type: t,
          label: COMM_META[t].label,
          blurb: COMM_META[t].blurb,
          primary: COMM_META[t].primary ?? false,
        })),
        caseFile: {
          opened: tasks.length > 0,
          tasks: tasks.map((t) => ({ id: t.id, label: t.label, done: t.done })),
          done: tasks.filter((t) => t.done).length,
          total: tasks.length,
        },
        referral: {
          canRefer,
          submitted: referral !== null,
          stage: referral?.stage ?? null,
          decision: referral?.decision ?? null,
          events: referralEvents.map((e) => ({
            id: e.id,
            occurredOn: e.occurredOn,
            text: e.text,
          })),
        },
        reviews: reviews.map((r) => ({
          id: r.id,
          scheduledFor: r.scheduledFor,
          note: r.note,
          attendees: r.attendees
            .map((id) => nameById.get(id))
            .filter((name): name is string => Boolean(name)),
          by: nameById.get(r.createdById) ?? "A colleague",
          createdAt: r.createdAt,
        })),
        audit: auditEvents.map((e) => ({
          id: e.id,
          action: e.action,
          createdAt: e.createdAt,
        })),
      };
    }),

  // Colleagues at the school, for tagging on a note (spec 5.5 notes). Excludes
  // the caller; sealed data only (names, never pupil data).
  directory: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const { db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const users = await db.user.findMany({
        where: { id: { not: ctx.session.user.id } },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      });
      return users.map((u) => ({ id: u.id, name: u.name ?? u.email }));
    }),

  // Reveal a pupil's identity (spec principle 2 / section 7). Gated: only once
  // the case reaches the action threshold (level 3+, or serious). A reason is
  // required and written to the audit trail with the reveal.
  reveal: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        reason: z.enum(REVEAL_REASONS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, severity: true, pupilId: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });
      if (!isRevealable(escalationLevel(signal.severity))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Identity stays sealed until the case reaches the action threshold (level 3 or above).",
        });
      }
      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "pupil.identity.revealed",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
        metadata: { reason: input.reason },
      });
      return { ok: true };
    }),

  // Dismiss a signal with a reason (spec 5.4 / principle 3). Reuses the audited,
  // atomic decision workflow; a reason of at least five characters is required
  // and becomes part of the safeguarding record.
  dismiss: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        reason: z.string().min(5).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      return decideSignal(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        signalId: input.signalId,
        kind: "DISMISS",
        note: input.reason,
      });
    }),

  // Add a case note, optionally tagging colleagues (spec 5.5). Append-only and
  // audited; the note and its audit entry are written atomically. A note never
  // carries a name — identity lives in the (sealed) pupil record, not the note.
  addNote: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        body: z.string().trim().min(1).max(4000),
        taggedUserIds: z.array(z.string()).max(20).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      // Only colleagues who really belong to this school may be tagged.
      const tagged = input.taggedUserIds.length
        ? await db.user.findMany({
            where: { id: { in: input.taggedUserIds } },
            select: { id: true },
          })
        : [];
      const taggedIds = tagged.map((u) => u.id);

      const userId = ctx.session.user.id;
      const noteId = await systemTransaction(async (tx) => {
        const note = await tx.caseNote.create({
          data: {
            tenantId: school.id,
            signalId: signal.id,
            pupilId: signal.pupilId,
            authorId: userId,
            body: input.body,
            taggedUserIds: taggedIds,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "case.note.added",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
            metadata: { taggedCount: taggedIds.length },
          },
        });
        return note.id;
      });
      return { id: noteId };
    }),

  // Draft a comm for a case (spec 5.6). Deterministic content built from the
  // real case data; the pupil appears by revealed name if the case is
  // revealed, otherwise by sealed reference. The LLM advisory draft (step 15)
  // will layer on and fall back to exactly this.
  draftComm: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        type: commTypeEnum,
      }),
    )
    .query(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        include: {
          pupil: {
            select: {
              upn: true,
              yearGroup: true,
              firstName: true,
              lastName: true,
            },
          },
          ruleVersion: { select: { key: true } },
        },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      const revealed = await db.auditEvent.findFirst({
        where: {
          entityType: "signal",
          entityId: signal.id,
          action: "pupil.identity.revealed",
        },
        select: { id: true },
      });
      const reasoning = signal.reasoning as SignalReasoning;
      const source = sourceForRule(signal.ruleVersion.key);
      const base = {
        schoolName: school.name,
        yearGroup: signal.pupil.yearGroup,
        window: `${ukDate(signal.windowStart)} to ${ukDate(signal.windowEnd)}`,
        dsl: ctx.session.user.name ?? "The Designated Safeguarding Lead",
        date: ukDate(new Date()),
        confidence: confidenceBand(signal.severity),
        timeline: reasoning.dataPoints.map((p) => ({
          date: p.date ?? null,
          label: p.label,
          source,
        })),
        overall: reasoning.summary,
      };
      const sealedRef = sealPupilRef(signal.pupil.upn);
      const data: CaseDraftData = {
        ...base,
        pupilRef: revealed
          ? `${signal.pupil.firstName} ${signal.pupil.lastName}`
          : sealedRef,
      };
      const sealedDraft = buildDraft(input.type, { ...base, pupilRef: sealedRef });

      // Advisory enhancement over the deterministic draft (spec step 15). The
      // model only ever sees the SEALED draft, so a revealed name is never sent
      // to it; on a revealed case the enhancement is skipped and the
      // name-bearing deterministic draft stands. Fallback on any failure.
      const model = getNarrativeModel();
      const result = await advise(db, {
        tenantId: school.id,
        surface: "comms-draft",
        signalId: signal.id,
        promptKey: COMMS_DRAFT_PROMPT.key,
        promptVersion: COMMS_DRAFT_PROMPT.version,
        input: sealedDraft,
        fallback: () => buildDraft(input.type, data),
        enhance: revealed ? undefined : () => enhanceComms(model, sealedDraft),
      });
      return { type: input.type, body: result.text, source: result.source };
    }),

  // File a (possibly edited) comm to the case as a document (spec 5.6). Written
  // and audited atomically; a case document never carries a pupil name.
  fileComm: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        type: commTypeEnum,
        body: z.string().trim().min(1).max(20000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      const meta = COMM_META[input.type];
      const userId = ctx.session.user.id;
      const summary = input.body.replace(/\s+/g, " ").slice(0, 200);

      const docId = await systemTransaction(async (tx) => {
        const doc = await tx.document.create({
          data: {
            tenantId: school.id,
            scope: "CASE",
            signalId: signal.id,
            pupilId: signal.pupilId,
            title: meta.docTitle,
            type: meta.docType,
            docDate: new Date(),
            status: "Filed",
            themes: meta.themes,
            summary,
            content: input.body,
            source: "comms",
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "case.comm.filed",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
            metadata: { commType: input.type, documentId: doc.id },
          },
        });
        return doc.id;
      });
      return { id: docId };
    }),

  // Open the case file (spec 5.7): seed the checklist from the case's
  // recommended route plus the standard closing steps. Idempotent, audited.
  openCaseFile: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true, severity: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await db.caseTask.count({
        where: { signalId: signal.id },
      });
      if (existing > 0) return { opened: true, created: 0 };

      const level = escalationLevel(signal.severity);
      const labels = [
        ...LEVEL_META[level].route,
        "Record the outcome and set a review date",
      ];
      const userId = ctx.session.user.id;
      const created = await systemTransaction(async (tx) => {
        await tx.caseTask.createMany({
          data: labels.map((label) => ({
            tenantId: school.id,
            signalId: signal.id,
            pupilId: signal.pupilId,
            label,
          })),
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "case.file.opened",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
            metadata: { steps: labels.length },
          },
        });
        return labels.length;
      });
      return { opened: true, created };
    }),

  // Toggle a checklist task done or not done (spec 5.7). Completing a task is
  // audited; reopening it is left unaudited to keep the trail signal-heavy.
  toggleCaseTask: tenancyProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const task = await db.caseTask.findUnique({
        where: { id: input.taskId },
        select: { id: true, signalId: true, pupilId: true, done: true, label: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const done = !task.done;
      await db.caseTask.update({ where: { id: task.id }, data: { done } });
      if (done) {
        await recordAuditEvent(db, {
          tenantId: school.id,
          userId: ctx.session.user.id,
          action: "case.task.completed",
          entityType: "signal",
          entityId: task.signalId,
          pupilId: task.pupilId,
          metadata: { task: task.label },
        });
      }
      return { done };
    }),

  // Schedule a pastoral review with optional attendees (spec 5.8). Append-only
  // and audited.
  scheduleReview: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        scheduledFor: z.string().trim().min(1).max(200),
        attendees: z.array(z.string()).max(20).default([]),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      const attendees = input.attendees.length
        ? (
            await db.user.findMany({
              where: { id: { in: input.attendees } },
              select: { id: true },
            })
          ).map((u) => u.id)
        : [];

      const userId = ctx.session.user.id;
      const reviewId = await systemTransaction(async (tx) => {
        const review = await tx.caseReview.create({
          data: {
            tenantId: school.id,
            signalId: signal.id,
            pupilId: signal.pupilId,
            scheduledFor: input.scheduledFor,
            attendees,
            note: input.note ?? null,
            createdById: userId,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "case.review.scheduled",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
            metadata: { scheduledFor: input.scheduledFor, attendees: attendees.length },
          },
        });
        return review.id;
      });
      return { id: reviewId };
    }),

  // Submit a MASH referral (spec 5.10). Watch never submits to MASH itself;
  // this records that the school has, and starts the lifecycle. One per case,
  // gated to cases serious enough to reveal identity. Audited.
  submitReferral: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true, severity: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });
      if (!isRevealable(escalationLevel(signal.severity))) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This case is not at the threshold for a referral.",
        });
      }
      const existing = await db.referral.findUnique({
        where: { signalId: signal.id },
        select: { id: true },
      });
      if (existing) return { submitted: true };

      const userId = ctx.session.user.id;
      await systemTransaction(async (tx) => {
        const referral = await tx.referral.create({
          data: {
            tenantId: school.id,
            signalId: signal.id,
            pupilId: signal.pupilId,
            stage: "submitted",
            createdById: userId,
          },
        });
        await tx.referralEvent.create({
          data: {
            tenantId: school.id,
            referralId: referral.id,
            occurredOn: ukDate(new Date()),
            text: "Referral submitted to MASH",
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "referral.submitted",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
          },
        });
      });
      return { submitted: true };
    }),

  // Chase, re-refer, or record a MASH decision on an existing referral
  // (spec 5.10). recordDecision is the apply step used by the MASH-response
  // reader (spec 5.11). Each advances the stage and appends an event, audited.
  advanceReferral: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        action: z.enum(["chase", "re-refer", "decide"]),
        decision: z.string().trim().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const referral = await db.referral.findUnique({
        where: { signalId: input.signalId },
      });
      if (!referral) throw new TRPCError({ code: "NOT_FOUND" });

      const map = {
        chase: {
          stage: "chased",
          text: "Progress chased with MASH",
          decision: referral.decision,
        },
        "re-refer": {
          stage: "re-referred",
          text: "Re-referred to MASH with further information",
          decision: null as string | null,
        },
        decide: {
          stage: "decided",
          text: `MASH decision recorded${input.decision ? `: ${input.decision}` : ""}`,
          decision: input.decision ?? "Decision recorded",
        },
      }[input.action];

      const userId = ctx.session.user.id;
      await systemTransaction(async (tx) => {
        await tx.referral.update({
          where: { id: referral.id },
          data: { stage: map.stage, decision: map.decision },
        });
        await tx.referralEvent.create({
          data: {
            tenantId: school.id,
            referralId: referral.id,
            occurredOn: ukDate(new Date()),
            text: map.text,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: `referral.${input.action === "decide" ? "decided" : input.action === "chase" ? "chased" : "re_referred"}`,
            entityType: "signal",
            entityId: referral.signalId,
            pupilId: referral.pupilId,
            metadata: input.decision ? { decision: input.decision } : undefined,
          },
        });
      });
      return { stage: map.stage };
    }),
});
