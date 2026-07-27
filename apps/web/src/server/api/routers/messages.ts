import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb, systemTransaction } from "@sentinel/db";

import { env } from "@/env";
import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { sendCaseEmail } from "@/server/comms/mailer";
import { COMM_TYPES, type CommType } from "@/server/comms/templates";
import { sealPupilRef } from "@/server/identity";

// Case communications (slice 4: email mission control, phase 1 — outbound). A
// human reviews a drafted referral or letter and sends it from the platform;
// the sent message is threaded to the case and written to the communications
// timeline and the audit log. The machine drafts, the person sends — there is
// no auto-send. Reads and writes are scoped to the user's school(s) and every
// send is audited.

const commTypeEnum = z.enum(COMM_TYPES as [CommType, ...CommType[]]);

// The verified sender (a verified subdomain) for phase 1. Phase 2 will send via
// the school's own connected mailbox so mail leaves from their domain.
function senderAddress(): string {
  return env.EMAIL_FROM ?? "Sentinel Watch <safeguarding@sentinelwatch.uk>";
}

// Resolves the school a case action targets: a DSL's single school, or the
// school a director names. (Mirrors the casework router's helper.)
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

export const messagesRouter = createTRPCRouter({
  // The communications timeline for a case: every message sent from the
  // platform, newest first. Sealed — the pupil is shown by reference unless the
  // case has been revealed.
  list: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = dbForSchool(
        ctx.tenancy,
        resolveSchoolId(ctx.tenancy, input.schoolId),
      );
      const signal = await db.signal.findUnique({
        where: { id: input.signalId },
        select: { id: true, pupilId: true },
      });
      if (!signal) throw new TRPCError({ code: "NOT_FOUND" });

      // Resolve the pupil separately under the same RLS context: a required
      // relation included inline throws the whole query if this signal's pupil
      // is unreadable here (e.g. a cross-tenant leftover).
      const pupil = await db.pupil.findUnique({
        where: { id: signal.pupilId },
        select: { upn: true },
      });
      if (!pupil) throw new TRPCError({ code: "NOT_FOUND" });

      const messages = await db.caseMessage.findMany({
        where: { signalId: signal.id },
        orderBy: { createdAt: "desc" },
      });

      // Resolve sender display names (not pupil data) for the timeline.
      const senderIds = [
        ...new Set(messages.map((m) => m.sentById).filter((id): id is string => !!id)),
      ];
      const senders = senderIds.length
        ? await systemDb.user.findMany({
            where: { id: { in: senderIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
      const senderName = new Map(
        senders.map((u) => [u.id, u.name ?? u.email]),
      );

      return {
        pupilRef: sealPupilRef(pupil.upn),
        messages: messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          status: m.status,
          commType: m.commType,
          from: m.fromAddress,
          to: m.toAddresses,
          subject: m.subject,
          body: m.body,
          sentBy: m.sentById ? (senderName.get(m.sentById) ?? "A colleague") : null,
          createdAt: m.createdAt,
        })),
      };
    }),

  // Send a reviewed message from the platform, threaded to the case. Records the
  // outcome either way: a SENT message on success, a FAILED one if the provider
  // rejects it — so an attempt never silently disappears. Audited.
  send: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        commType: commTypeEnum.optional(),
        to: z.array(z.string().email()).min(1).max(20),
        subject: z.string().trim().min(1).max(300),
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

      const from = senderAddress();
      const userId = ctx.session.user.id;

      let providerMessageId: string | null = null;
      let sendError: unknown = null;
      try {
        const result = await sendCaseEmail({
          from,
          to: input.to,
          subject: input.subject,
          body: input.body,
        });
        providerMessageId = result.providerMessageId;
      } catch (error) {
        sendError = error;
      }

      // Record the message and audit it atomically — success or failure.
      const status = sendError ? "FAILED" : "SENT";
      const messageId = await systemTransaction(async (tx) => {
        const message = await tx.caseMessage.create({
          data: {
            tenantId: school.id,
            signalId: signal.id,
            pupilId: signal.pupilId,
            direction: "OUTBOUND",
            status,
            commType: input.commType ?? null,
            fromAddress: from,
            toAddresses: input.to,
            subject: input.subject,
            body: input.body,
            sentById: userId,
            providerMessageId,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: sendError ? "case.message.send_failed" : "case.message.sent",
            entityType: "signal",
            entityId: signal.id,
            pupilId: signal.pupilId,
            metadata: {
              messageId: message.id,
              commType: input.commType ?? null,
              recipients: input.to.length,
            },
          },
        });
        return message.id;
      });

      if (sendError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "The message could not be sent. It's saved to the case as failed — you can try again.",
        });
      }
      return { id: messageId, status };
    }),
});
