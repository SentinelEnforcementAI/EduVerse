import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb, systemTransaction } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { sealPupilRef } from "@/server/identity";

// The intake queue (commercialisation slice 4, phase 2: inbound capture).
// Inbound safeguarding mail that couldn't be matched automatically waits here
// for a DSL to assign it to the right child's case, or dismiss it — so nothing
// slips through the gaps. Assigning creates an INBOUND CaseMessage on the case.
// Scoped to the user's school(s); every assign and dismiss is audited.

function resolveSchoolId(
  tenancy: { mode: "school" | "mat"; schools: { id: string }[] },
  schoolId: string | undefined,
): string {
  const resolved =
    schoolId ?? (tenancy.mode === "school" ? tenancy.schools[0]?.id : undefined);
  if (!resolved) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a school." });
  }
  return resolved;
}

export const intakeRouter = createTRPCRouter({
  // Pending intake items for the school, plus the open cases a DSL can assign
  // them to (sealed — a reference and a title, never a name).
  list: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const { db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const items = await db.intakeItem.findMany({
        where: { status: "PENDING" },
        orderBy: { receivedAt: "desc" },
        take: 100,
      });
      const openSignals = await db.signal.findMany({
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, title: true, pupil: { select: { upn: true } } },
      });
      return {
        items: items.map((i) => ({
          id: i.id,
          from: i.fromAddress,
          subject: i.subject,
          body: i.body,
          receivedAt: i.receivedAt,
        })),
        cases: openSignals.map((s) => ({
          signalId: s.id,
          ref: sealPupilRef(s.pupil.upn),
          title: s.title,
        })),
      };
    }),

  // Count of pending items, for the nav badge.
  count: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const { db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      return db.intakeItem.count({ where: { status: "PENDING" } });
    }),

  // Assign an intake item to a case: record it as an INBOUND message on that
  // case and close the item. Atomic and audited.
  assign: tenancyProcedure
    .input(
      z.object({
        intakeItemId: z.string().min(1),
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const item = await db.intakeItem.findUnique({
        where: { id: input.intakeItemId },
      });
      if (!item || item.status !== "PENDING") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      const userId = ctx.session.user.id;
      const messageId = await systemTransaction(async (tx) => {
        const message = await tx.caseMessage.create({
          data: {
            tenantId: school.id,
            signalId: signal.id,
            pupilId: signal.pupilId,
            direction: "INBOUND",
            status: "SENT",
            fromAddress: item.fromAddress,
            toAddresses: [item.toAddress],
            subject: item.subject,
            body: item.body,
            threadId: item.threadId,
            providerMessageId: item.providerMessageId,
          },
        });
        await tx.intakeItem.update({
          where: { id: item.id },
          data: {
            status: "ASSIGNED",
            assignedSignalId: signal.id,
            assignedById: userId,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "intake.assigned",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
            metadata: { intakeItemId: item.id, messageId: message.id },
          },
        });
        return message.id;
      });
      return { id: messageId };
    }),

  // Dismiss an intake item (not relevant to a case). A status change, audited —
  // the item is kept, never deleted.
  dismiss: tenancyProcedure
    .input(
      z.object({
        intakeItemId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const item = await db.intakeItem.findUnique({
        where: { id: input.intakeItemId },
      });
      if (!item || item.status !== "PENDING") {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await db.intakeItem.update({
        where: { id: item.id },
        data: { status: "DISMISSED", assignedById: ctx.session.user.id },
      });
      await systemDb.auditEvent.create({
        data: {
          tenantId: school.id,
          userId: ctx.session.user.id,
          action: "intake.dismissed",
          entityType: "intake",
          entityId: item.id,
          metadata: {},
        },
      });
      return { ok: true };
    }),
});
