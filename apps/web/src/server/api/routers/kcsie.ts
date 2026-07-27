import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemTransaction, type Tenancy, type TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { recordAuditEvent } from "@/server/audit";
import {
  deriveComponents,
  STATUS_LABEL,
  type ComplianceComponent,
} from "@/server/compliance/kcsie";

function schoolFor(tenancy: Tenancy, schoolId: string | undefined) {
  const resolved =
    schoolId ?? (tenancy.mode === "school" ? tenancy.schools[0]?.id : undefined);
  if (!resolved) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose a school." });
  }
  return dbForSchool(tenancy, resolved);
}

function ukDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function componentsFor(db: TenantDb, now: Date) {
  const docs = await db.document.findMany({
    where: { scope: "ORG" },
    orderBy: { docDate: "desc" },
    take: 200,
  });
  return deriveComponents(
    docs.map((d) => ({
      type: d.type,
      title: d.title,
      themes: d.themes,
      docDate: d.docDate,
      status: d.status,
      content: d.content,
      summary: d.summary,
    })),
    now,
  );
}

export const kcsieRouter = createTRPCRouter({
  // KCSIE compliance for one school (spec 5.12): seven components, each derived.
  school: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const { components, overall } = await componentsFor(db, new Date());
      return {
        schoolId: school.id,
        schoolName: school.name,
        overall,
        overallLabel: STATUS_LABEL[overall],
        components,
      };
    }),

  // Trust compliance table (spec 5.12): each school's overall KCSIE status.
  trust: tenancyProcedure.query(async ({ ctx }) => {
    if (ctx.tenancy.mode !== "mat") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const rows = await Promise.all(
      ctx.tenancy.schools.map(async (s) => {
        const { db } = dbForSchool(ctx.tenancy, s.id);
        const { overall, components } = await componentsFor(db, new Date());
        const outstanding = components.filter((c) => c.status !== "ok").length;
        return {
          id: s.id,
          name: s.name,
          overall,
          overallLabel: STATUS_LABEL[overall],
          outstanding,
        };
      }),
    );
    return { schools: rows };
  }),

  // Section 175 pre-fill (spec 5.12). Watch never submits: it pre-fills the
  // return from the derived components; the school submits to the local
  // authority. Filed to the vault and audited. UK English, no em dashes.
  section175: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const { components } = await componentsFor(db, new Date());
      const lines = components
        .map((c) => `- ${c.label}: ${STATUS_LABEL[c.status]}. ${c.detail}.`)
        .join("\n");
      const content = `SECTION 175 SAFEGUARDING SELF-ASSESSMENT (PRE-FILL)
${school.name}
Prepared by Sentinel Watch on ${ukDate(new Date())}

This return is pre-filled from the school's records. Review each line, then submit to the local authority. Watch does not submit on the school's behalf.

STANDARDS
${lines}

The school confirms that safeguarding arrangements are reviewed regularly and that any actions marked as due are being progressed.`;

      const doc = await db.document.create({
        data: {
          tenantId: school.id,
          scope: "ORG",
          title: "Section 175 Self-Assessment (Pre-fill)",
          type: "Return",
          docDate: new Date(),
          status: "Filed",
          themes: ["compliance", "return", "section 175", "local authority"],
          summary: "Section 175 return pre-filled from the school's records.",
          content,
          generated: true,
          source: "kcsie",
        },
      });
      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "kcsie.s175_prefilled",
        entityType: "document",
        entityId: doc.id,
      });
      return { id: doc.id };
    }),

  // Governor compliance pack (spec 5.12): a board-ready summary of the seven
  // components, filed to the vault and audited.
  compliancePack: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const { components, overall } = await componentsFor(db, new Date());
      const lines = components
        .map(
          (c: ComplianceComponent) =>
            `- ${c.label}: ${STATUS_LABEL[c.status]}. ${c.detail}. ${c.due}.`,
        )
        .join("\n");
      const content = `KCSIE COMPLIANCE PACK FOR GOVERNORS
${school.name}
Prepared by Sentinel Watch on ${ukDate(new Date())}

OVERALL STATUS: ${STATUS_LABEL[overall]}

COMPONENTS
${lines}

This pack summarises the school's safeguarding compliance against KCSIE 2026. Each component is derived from the school's records held in the repository.`;

      const doc = await db.document.create({
        data: {
          tenantId: school.id,
          scope: "ORG",
          title: "KCSIE Compliance Pack",
          type: "Report",
          docDate: new Date(),
          status: "Filed",
          themes: ["compliance", "governance", "assurance", "kcsie"],
          summary: `Governor compliance pack. Overall status: ${STATUS_LABEL[overall]}.`,
          content,
          generated: true,
          source: "kcsie",
        },
      });
      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "kcsie.pack_generated",
        entityType: "document",
        entityId: doc.id,
      });
      return { id: doc.id };
    }),

  // A single component's workspace (spec 5.13): owner, tasks, attached evidence,
  // and the activity log. Reads only; mutations below.
  component: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        key: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const { components } = await componentsFor(db, new Date());
      const component = components.find((c) => c.key === input.key);
      if (!component) throw new TRPCError({ code: "NOT_FOUND" });

      const [owner, tasks, evidence, orgDocs, activity] = await Promise.all([
        db.user.findFirst({
          where: { role: "DSL" },
          select: { name: true },
          orderBy: { createdAt: "asc" },
        }),
        db.kcsieTask.findMany({
          where: { componentKey: input.key },
          orderBy: { createdAt: "asc" },
        }),
        db.kcsieEvidence.findMany({ where: { componentKey: input.key } }),
        db.document.findMany({
          where: { scope: "ORG" },
          select: { id: true, title: true, type: true },
          orderBy: { docDate: "desc" },
        }),
        db.auditEvent.findMany({
          where: { entityType: "kcsie", entityId: input.key },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      ]);
      const docById = new Map(orgDocs.map((d) => [d.id, d]));

      return {
        schoolId: school.id,
        schoolName: school.name,
        component,
        owner: owner?.name ?? "The DSL",
        tasks: tasks.map((t) => ({ id: t.id, label: t.label, done: t.done })),
        evidence: evidence
          .map((e) => docById.get(e.documentId))
          .filter((d): d is NonNullable<typeof d> => Boolean(d)),
        availableDocuments: orgDocs,
        activity: activity.map((a) => ({
          id: a.id,
          action: a.action,
          createdAt: a.createdAt,
        })),
      };
    }),

  addTask: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        key: z.string().min(1),
        label: z.string().trim().min(1).max(300),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // schoolFor validates access even though the writes go through the
      // system-context transaction below.
      const { school } = schoolFor(ctx.tenancy, input.schoolId);
      const userId = ctx.session.user.id;
      const id = await systemTransaction(async (tx) => {
        const task = await tx.kcsieTask.create({
          data: {
            tenantId: school.id,
            componentKey: input.key,
            label: input.label,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "kcsie.task.added",
            entityType: "kcsie",
            entityId: input.key,
            metadata: { task: input.label },
          },
        });
        return task.id;
      });
      return { id };
    }),

  toggleTask: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        taskId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const task = await db.kcsieTask.findUnique({
        where: { id: input.taskId },
        select: { id: true, done: true, componentKey: true, label: true },
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      const done = !task.done;
      await db.kcsieTask.update({ where: { id: task.id }, data: { done } });
      if (done) {
        await recordAuditEvent(db, {
          tenantId: school.id,
          userId: ctx.session.user.id,
          action: "kcsie.task.completed",
          entityType: "kcsie",
          entityId: task.componentKey,
          metadata: { task: task.label },
        });
      }
      return { done };
    }),

  attachEvidence: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        key: z.string().min(1),
        documentId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const doc = await db.document.findUnique({
        where: { id: input.documentId },
        select: { id: true, title: true },
      });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await db.kcsieEvidence.findUnique({
        where: {
          tenantId_componentKey_documentId: {
            tenantId: school.id,
            componentKey: input.key,
            documentId: doc.id,
          },
        },
        select: { id: true },
      });
      if (existing) return { attached: true };

      const userId = ctx.session.user.id;
      await systemTransaction(async (tx) => {
        await tx.kcsieEvidence.create({
          data: {
            tenantId: school.id,
            componentKey: input.key,
            documentId: doc.id,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: school.id,
            userId,
            action: "kcsie.evidence.attached",
            entityType: "kcsie",
            entityId: input.key,
            metadata: { document: doc.title },
          },
        });
      });
      return { attached: true };
    }),
});
