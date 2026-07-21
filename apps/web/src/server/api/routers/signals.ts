import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";

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
              firstName: true,
              lastName: true,
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

      return signals.map((signal) => ({
        id: signal.id,
        status: signal.status,
        severity: signal.severity,
        title: signal.title,
        updatedAt: signal.updatedAt,
        windowEnd: signal.windowEnd,
        pupil: signal.pupil,
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
              firstName: true,
              lastName: true,
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

      return signal;
    }),
});
