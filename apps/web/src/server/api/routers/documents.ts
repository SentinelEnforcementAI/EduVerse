import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { Tenancy } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { advise } from "@/server/advisory/advise";
import {
  enhanceSynthesis,
  SEARCH_SYNTHESIS_PROMPT,
} from "@/server/advisory/enhance";
import { recordAuditEvent } from "@/server/audit";
import { rankDocuments, synthesise } from "@/server/documents/search";
import { getNarrativeModel } from "@/server/narrative/model-provider";

function schoolFor(tenancy: Tenancy, schoolId: string | undefined) {
  const resolved =
    schoolId ?? (tenancy.mode === "school" ? tenancy.schools[0]?.id : undefined);
  if (!resolved) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Choose a school to view its documents.",
    });
  }
  return dbForSchool(tenancy, resolved);
}

export const documentsRouter = createTRPCRouter({
  // The trust-wide document repository (spec 5.9), for a director: every school's
  // safeguarding documents in one place. Read from each school through its own
  // RLS context and merged in application code — there is no cross-tenant query.
  // Director-only; a DSL uses the single-school vault above.
  trustVault: tenancyProcedure.query(async ({ ctx }) => {
    if (ctx.tenancy.mode !== "mat" || !ctx.tenancy.trustId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "The trust repository is available to trust leadership only.",
      });
    }

    const perSchool = await Promise.all(
      ctx.tenancy.schools.map(async (s) => {
        const { db } = dbForSchool(ctx.tenancy, s.id);
        const docs = await db.document.findMany({
          where: { scope: "ORG" },
          orderBy: { docDate: "desc" },
          take: 200,
        });
        return { school: s, docs };
      }),
    );

    const documents = perSchool
      .flatMap(({ school, docs }) =>
        docs.map((d) => ({
          id: d.id,
          schoolId: school.id,
          schoolName: school.name,
          title: d.title,
          type: d.type,
          status: d.status,
          docDate: d.docDate,
          themes: d.themes,
          summary: d.summary,
        })),
      )
      .sort((a, b) => b.docDate.getTime() - a.docDate.getTime());

    // Per-school rollup: how many documents each school holds and its most
    // recent filing — the director's first read of repository coverage.
    const schools = perSchool.map(({ school, docs }) => ({
      id: school.id,
      name: school.name,
      total: docs.length,
      current: docs.filter((d) => d.status === "Current").length,
      latest: docs[0]?.docDate ?? null,
    }));

    // Document-type facet across the trust (Policy, Record, Training, …), so the
    // repository can be read by kind, not just by school.
    const typeCounts = new Map<string, number>();
    for (const d of documents) {
      typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1);
    }
    const types = [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totals: {
        schools: schools.length,
        documents: documents.length,
        current: documents.filter((d) => d.status === "Current").length,
      },
      schools,
      types,
      documents,
    };
  }),

  // The org vault (spec 5.9): policies, records and generated documents.
  vault: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .query(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const docs = await db.document.findMany({
        where: { scope: "ORG" },
        orderBy: { docDate: "desc" },
        take: 200,
      });
      return {
        schoolId: school.id,
        schoolName: school.name,
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          docDate: d.docDate,
          themes: d.themes,
          summary: d.summary,
          generated: d.generated,
        })),
      };
    }),

  // Contextual search (spec 5.9): matches content and themes, not filenames,
  // and explains each match. The read is audited.
  search: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        query: z.string().trim().min(1).max(200),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      // The whole repository is in scope: org policies, generated documents and
      // sealed case documents (which carry sealed references, never names).
      const docs = await db.document.findMany({ take: 500 });
      const hits = rankDocuments(
        docs.map((d) => ({
          id: d.id,
          title: d.title,
          type: d.type,
          status: d.status,
          docDate: d.docDate,
          themes: d.themes,
          summary: d.summary,
          content: d.content,
          scope: d.scope,
        })),
        input.query,
      );

      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "documents.searched",
        entityType: "document",
        metadata: { query: input.query, hits: hits.length },
      });

      // Advisory synthesis over the results, with the deterministic summary as
      // the fallback (spec step 15). The model, if reachable, only sees titles
      // and themes.
      const model = getNarrativeModel();
      const synthesis = await advise(db, {
        tenantId: school.id,
        surface: "search-synthesis",
        promptKey: SEARCH_SYNTHESIS_PROMPT.key,
        promptVersion: SEARCH_SYNTHESIS_PROMPT.version,
        input: input.query,
        fallback: () => synthesise(input.query, hits),
        enhance: () =>
          enhanceSynthesis(
            model,
            input.query,
            hits.map((h) => ({ title: h.title, matchedThemes: h.matchedThemes })),
          ),
      });

      return {
        query: input.query,
        synthesis: synthesis.text,
        synthesisSource: synthesis.source,
        hits: hits.slice(0, 50),
      };
    }),

  // Open a document (spec 5.10). Reading is audited; a case document's read is
  // attributed to the pupil it concerns.
  byId: tenancyProcedure
    .input(
      z.object({
        schoolId: z.string().min(1).optional(),
        id: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const doc = await db.document.findUnique({ where: { id: input.id } });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "document.viewed",
        entityType: "document",
        entityId: doc.id,
        pupilId: doc.pupilId ?? undefined,
      });

      return {
        id: doc.id,
        title: doc.title,
        type: doc.type,
        status: doc.status,
        docDate: doc.docDate,
        themes: doc.themes,
        content: doc.content,
      };
    }),

  // Assemble an inspection evidence pack (spec 5.9) from the vault, filed back
  // as a generated document. UK English, no em dashes. Audited.
  evidencePack: tenancyProcedure
    .input(z.object({ schoolId: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { school, db } = schoolFor(ctx.tenancy, input.schoolId);
      const docs = await db.document.findMany({
        where: { scope: "ORG" },
        orderBy: { docDate: "desc" },
        take: 200,
      });
      const lines = docs
        .map(
          (d) =>
            `- ${d.title} (${d.type}, ${d.status}, ${d.docDate.toLocaleDateString("en-GB")})`,
        )
        .join("\n");
      const content = `INSPECTION EVIDENCE PACK
${school.name}
Prepared by Sentinel Watch on ${new Date().toLocaleDateString("en-GB")}

This pack lists the safeguarding documents held in the repository, ready for inspection. Each document is available in full on request.

DOCUMENTS
${lines}

Every read and change against a child's record is logged in the audit trail. Pupil identity stays sealed until a case crosses the action threshold, at which point a reveal is recorded with a reason.`;

      const doc = await db.document.create({
        data: {
          tenantId: school.id,
          scope: "ORG",
          title: "Inspection Evidence Pack",
          type: "Report",
          docDate: new Date(),
          status: "Filed",
          themes: ["inspection", "assurance", "governance"],
          summary: `Evidence pack listing ${docs.length} safeguarding documents.`,
          content,
          generated: true,
          source: "evidence-pack",
        },
      });
      await recordAuditEvent(db, {
        tenantId: school.id,
        userId: ctx.session.user.id,
        action: "documents.evidence_pack_generated",
        entityType: "document",
        entityId: doc.id,
        metadata: { documents: docs.length },
      });
      return { id: doc.id };
    }),
});
