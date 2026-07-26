import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import { sealPupilRef } from "@/server/identity";
import { generateNarrative } from "@/server/narrative/generate";
import { getNarrativeModel } from "@/server/narrative/model-provider";
import { decideSignal } from "@/server/signals/decide";

const STATUSES = ["OPEN", "CONFIRMED", "DISMISSED", "ESCALATED"] as const;

export const signalsRouter = createTRPCRouter({
  // Counts by status for the caller's school.
  summary: tenantProcedure.query(async ({ ctx }) => {
    const grouped = await ctx.tenantDb.signal.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0, ESCALATED: 0 };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }
    return counts;
  }),

  // Flagged pupils for review, most severe first. Every read is audited.
  list: tenantProcedure
    .input(z.object({ status: z.enum(STATUSES).default("OPEN") }).optional())
    .query(async ({ ctx, input }) => {
      const status = input?.status ?? "OPEN";
      const signals = await ctx.tenantDb.signal.findMany({
        where: { status },
        include: {
          pupil: {
            select: {
              id: true,
              upn: true,
              yearGroup: true,
              registrationGroup: true,
            },
          },
          ruleVersion: { select: { key: true, name: true, version: true } },
        },
        orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
        take: 200,
      });

      await recordAuditEvent(ctx.tenantDb, {
        tenantId: ctx.tenantId,
        userId: ctx.session.user.id,
        action: "signals.listed",
        entityType: "signal",
        metadata: { status, count: signals.length },
      });

      // A list surface: sealed reference only — never a name. Reveal is a
      // deliberate, audited action on a single case (see casework.reveal).
      return signals.map((signal) => ({
        id: signal.id,
        status: signal.status,
        severity: signal.severity,
        title: signal.title,
        updatedAt: signal.updatedAt,
        windowEnd: signal.windowEnd,
        pupil: {
          id: signal.pupil.id,
          ref: sealPupilRef(signal.pupil.upn),
          yearGroup: signal.pupil.yearGroup,
          registrationGroup: signal.pupil.registrationGroup,
        },
        rule: signal.ruleVersion,
      }));
    }),

  // Full signal detail: the pupil, the exact rule version that fired, and
  // the complete reasoning. Reading a child's record — always audited.
  byId: tenantProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const signal = await ctx.tenantDb.signal.findUnique({
        where: { id: input.id },
        include: {
          pupil: {
            select: {
              id: true,
              upn: true,
              yearGroup: true,
              registrationGroup: true,
            },
          },
          ruleVersion: true,
          execution: { select: { id: true, startedAt: true, asOf: true } },
        },
      });
      if (!signal) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      await recordAuditEvent(ctx.tenantDb, {
        tenantId: ctx.tenantId,
        userId: ctx.session.user.id,
        action: "signal.viewed",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
      });

      // Decision history (append-only table, no relations — joined by hand).
      const decisions = await ctx.tenantDb.signalDecision.findMany({
        where: { signalId: signal.id },
        orderBy: { createdAt: "desc" },
      });
      const users = await ctx.tenantDb.user.findMany({
        where: { id: { in: decisions.map((d) => d.userId) } },
        select: { id: true, name: true, email: true },
      });
      const usersById = new Map(users.map((u) => [u.id, u]));

      // Latest AI narrative, if one has been generated (advisory, labelled).
      const narrative = await ctx.tenantDb.signalNarrative.findFirst({
        where: { signalId: signal.id },
        orderBy: { createdAt: "desc" },
      });

      // Sealed by default: the detail carries a sealed reference, never a name
      // or UPN. Name reveal lives on the gated, audited casework.reveal path.
      const { pupil, ...signalRest } = signal;
      return {
        ...signalRest,
        pupil: {
          id: pupil.id,
          ref: sealPupilRef(pupil.upn),
          yearGroup: pupil.yearGroup,
          registrationGroup: pupil.registrationGroup,
        },
        narrative: narrative
          ? {
              id: narrative.id,
              content: narrative.content,
              aiGenerated: narrative.aiGenerated,
              promptKey: narrative.promptKey,
              promptVersion: narrative.promptVersion,
              modelId: narrative.modelId,
              createdAt: narrative.createdAt,
            }
          : null,
        decisions: decisions.map((decision) => ({
          id: decision.id,
          kind: decision.kind,
          note: decision.note,
          createdAt: decision.createdAt,
          decidedBy:
            usersById.get(decision.userId)?.name ??
            usersById.get(decision.userId)?.email ??
            "Unknown user",
        })),
      };
    }),

  // A DSL's decision: confirm, dismiss (note required), or escalate.
  // Applied atomically with the decision record and audit entry.
  decide: tenantProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        kind: z.enum(["CONFIRM", "DISMISS", "ESCALATE"]),
        note: z.string().max(2000).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      decideSignal(ctx.tenantDb, {
        tenantId: ctx.tenantId,
        userId: ctx.session.user.id,
        signalId: input.signalId,
        kind: input.kind,
        note: input.note ?? null,
      }),
    ),

  // AI advisory narrative for a CONFIRMED signal. Server-side Bedrock
  // (eu-west-2) on pseudonymised data; every call audited with prompt and
  // model versions. Output is advisory only and cannot change signal state.
  generateNarrative: tenantProcedure
    .input(z.object({ signalId: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      generateNarrative(ctx.tenantDb, getNarrativeModel(), {
        tenantId: ctx.tenantId,
        userId: ctx.session.user.id,
        signalId: input.signalId,
      }),
    ),
});
