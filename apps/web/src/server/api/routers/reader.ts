import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemTransaction, type Tenancy } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import {
  parseMashResponse,
  parseTrainingCertificate,
} from "@/server/reader/parse";

function schoolFor(tenancy: Tenancy, schoolId: string | undefined) {
  const resolved =
    schoolId ?? (tenancy.mode === "school" ? tenancy.schools[0]?.id : undefined);
  if (!resolved) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a school." });
  }
  return dbForSchool(tenancy, resolved);
}

function ukDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const readerRouter = createTRPCRouter({
  // Read a MASH response and PROPOSE the decision to record (spec 5.11). No
  // state changes here: proposing and applying are separate, and only a person
  // applies.
  readMashResponse: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        text: z.string().trim().min(1).max(20000),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = schoolFor(ctx.tenancy, input.schoolId);
      const referral = await db.referral.findUnique({
        where: { signalId: input.signalId },
        select: { id: true },
      });
      if (!referral) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "There is no referral on this case to update.",
        });
      }
      return parseMashResponse(input.text);
    }),

  // Apply a MASH decision the DSL has confirmed (spec 5.11): advance the
  // referral, file the response as a case document, and audit — atomically.
  applyMashResponse: tenancyProcedure
    .input(
      z.object({
        signalId: z.string().min(1),
        schoolId: z.string().min(1).optional(),
        decision: z.string().trim().min(1).max(500),
        nextStep: z.string().trim().min(1).max(1000),
        rationale: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const referral = await db.referral.findUnique({
        where: { signalId: input.signalId },
      });
      if (!referral) throw new TRPCError({ code: "NOT_FOUND" });

      const userId = ctx.session.user.id;
      const content = `MASH RESPONSE

Decision: ${input.decision}

Rationale: ${input.rationale}

Next step: ${input.nextStep}

Read by Watch and confirmed by the DSL on ${ukDate(new Date())}.`;

      const docId = await systemTransaction(async (tx) => {
        await tx.referral.update({
          where: { id: referral.id },
          data: { stage: "decided", decision: input.decision },
        });
        await tx.referralEvent.create({
          data: {
            tenantId: school.id,
            referralId: referral.id,
            occurredOn: ukDate(new Date()),
            text: `MASH decision recorded: ${input.decision}`,
          },
        });
        const doc = await tx.document.create({
          data: {
            tenantId: school.id,
            scope: "CASE",
            signalId: referral.signalId,
            pupilId: referral.pupilId,
            title: "MASH Response",
            type: "Record",
            docDate: new Date(),
            status: "Filed",
            themes: ["child protection", "mash", "referral"],
            summary: `MASH decision: ${input.decision}. ${input.rationale}`.slice(0, 200),
            content,
            source: "reader",
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "mash.response.applied",
            entityType: "signal",
            entityId: referral.signalId,
            pupilId: referral.pupilId,
            metadata: { decision: input.decision, documentId: doc.id },
          },
        });
        return doc.id;
      });
      return { documentId: docId };
    }),

  // Read a training certificate and PROPOSE the renewal to record (spec 5.11).
  readTrainingCertificate: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        text: z.string().trim().min(1).max(20000),
      }),
    )
    .query(({ input }) => parseTrainingCertificate(input.text)),

  // Apply a training record the DSL has confirmed (spec 5.11): file it to the
  // vault and audit. The KCSIE component link lands with the compliance slice.
  applyTrainingRecord: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        course: z.string().trim().min(1).max(200),
        renews: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const userId = ctx.session.user.id;
      const doc = await db.document.create({
        data: {
          tenantId: school.id,
          scope: "ORG",
          title: `Training Record: ${input.course}`,
          type: "Training",
          docDate: new Date(),
          status: "Current",
          themes: ["training", "compliance", "kcsie"],
          summary: `${input.course}. ${input.renews}.`,
          content: `TRAINING RECORD\n\nCourse: ${input.course}\n${input.renews}\n\nRead by Watch and confirmed by the DSL on ${ukDate(new Date())}.`,
          generated: true,
          source: "reader",
        },
      });
      await recordAuditEvent(db, {
        tenantId: school.id,
        userId,
        action: "training.record.applied",
        entityType: "document",
        entityId: doc.id,
        metadata: { course: input.course, renews: input.renews },
      });
      return { documentId: doc.id };
    }),
});
