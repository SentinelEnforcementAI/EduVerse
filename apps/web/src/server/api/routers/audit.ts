import { z } from "zod";

import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import { sealPupilRef } from "@/server/identity";

const PAGE_SIZE = 50;

export const auditRouter = createTRPCRouter({
  // The school's audit trail: who read or changed what about a child's
  // record, when. Viewing the audit log is itself an audited read.
  list: tenantProcedure
    .input(
      z
        .object({
          page: z.number().int().min(0).default(0),
          action: z.string().max(100).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? 0;
      const action = input?.action;
      const where = action ? { action } : {};

      const [events, total, actions] = await Promise.all([
        ctx.tenantDb.auditEvent.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: page * PAGE_SIZE,
          take: PAGE_SIZE,
        }),
        ctx.tenantDb.auditEvent.count({ where }),
        ctx.tenantDb.auditEvent.groupBy({ by: ["action"] }),
      ]);

      const userIds = [...new Set(events.map((e) => e.userId).filter(Boolean))] as string[];
      const pupilIds = [...new Set(events.map((e) => e.pupilId).filter(Boolean))] as string[];
      const [users, pupils] = await Promise.all([
        userIds.length
          ? ctx.tenantDb.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true },
            })
          : [],
        pupilIds.length
          ? ctx.tenantDb.pupil.findMany({
              where: { id: { in: pupilIds } },
              // Sealed reference only — the audit log identifies a child by
              // their sealed reference, never their name (spec principle 2).
              // The name lives in the pupil record; the reveal of it is itself
              // one of the audited actions listed here.
              select: { id: true, upn: true },
            })
          : [],
      ]);
      const usersById = new Map(users.map((u) => [u.id, u.name ?? u.email]));
      const pupilsById = new Map(
        pupils.map((p) => [p.id, sealPupilRef(p.upn)]),
      );

      await recordAuditEvent(ctx.tenantDb, {
        tenantId: ctx.tenantId,
        userId: ctx.session.user.id,
        action: "audit.viewed",
        entityType: "audit",
        metadata: { page, action: action ?? null },
      });

      return {
        page,
        pageSize: PAGE_SIZE,
        total,
        availableActions: actions.map((a) => a.action).sort(),
        events: events.map((event) => ({
          id: event.id,
          createdAt: event.createdAt,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          user: event.userId
            ? (usersById.get(event.userId) ?? "Unknown user")
            : "System",
          // Audit rows outlive what they reference: a missing pupil row is
          // reported, never hidden.
          pupil: event.pupilId
            ? (pupilsById.get(event.pupilId) ?? "Pupil no longer on roll")
            : null,
          metadata: event.metadata,
        })),
      };
    }),
});
