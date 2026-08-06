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
  trustVault: tenancyProcedure
    .input(
      z
        .object({
          schoolId: z.string().min(1).optional(),
          type: z.string().min(1).optional(),
          // A real status (e.g. "Current") or the special "review" for the
          // needs-review set.
          status: z.string().min(1).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (ctx.tenancy.mode !== "mat" || !ctx.tenancy.trustId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The trust repository is available to trust leadership only.",
        });
      }
      const applied = {
        schoolId: input?.schoolId,
        type: input?.type,
        status: input?.status,
      };

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

      // A document needs review when it is no longer marked Current, or when its
      // last review is over a year old — the governance question a director asks
      // of the repository. (Annual review is the safeguarding norm.)
      const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
      const nowMs = Date.now();
      const needsReview = (status: string, docDate: Date) =>
        status !== "Current" || nowMs - docDate.getTime() > YEAR_MS;

      // The full trust set drives the facets and rollup; the display list is
      // then filtered by the chosen school, document type and status.
      const all = perSchool
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
            reviewDue: needsReview(d.status, d.docDate),
          })),
        )
        .sort((a, b) => b.docDate.getTime() - a.docDate.getTime());

      const documents = all.filter(
        (d) =>
          (!applied.schoolId || d.schoolId === applied.schoolId) &&
          (!applied.type || d.type === applied.type) &&
          (!applied.status ||
            (applied.status === "review"
              ? d.reviewDue
              : d.status === applied.status)),
      );

      // Per-school rollup: coverage, how many are current, how many need review,
      // and the most recent filing — the director's read of repository health.
      const schools = perSchool.map(({ school, docs }) => ({
        id: school.id,
        name: school.name,
        total: docs.length,
        current: docs.filter((d) => d.status === "Current").length,
        needsReview: docs.filter((d) => needsReview(d.status, d.docDate)).length,
        latest: docs[0]?.docDate ?? null,
      }));

      // Facets from the unfiltered set so the filter options never collapse to
      // the current selection.
      const typeCounts = new Map<string, number>();
      const statusCounts = new Map<string, number>();
      for (const d of all) {
        typeCounts.set(d.type, (typeCounts.get(d.type) ?? 0) + 1);
        statusCounts.set(d.status, (statusCounts.get(d.status) ?? 0) + 1);
      }
      const types = [...typeCounts.entries()]
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);
      const statuses = [...statusCounts.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      const current = all.filter((d) => d.status === "Current").length;
      const reviewCount = all.filter((d) => d.reviewDue).length;

      return {
        totals: {
          schools: schools.length,
          documents: all.length,
          current,
          needsReview: reviewCount,
        },
        schools,
        types,
        statuses,
        documents,
        total: all.length,
        shown: documents.length,
        applied,
      };
    }),

  // Trust-wide contextual ("conversational") search over every school's
  // repository, for a director. Matches what a document says and the themes it
  // covers, not filenames, and explains each match. Read from each school
  // through its own RLS context; the read is audited per school. Director-only.
  trustSearch: tenancyProcedure
    .input(z.object({ query: z.string().trim().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      if (ctx.tenancy.mode !== "mat" || !ctx.tenancy.trustId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "The trust repository is available to trust leadership only.",
        });
      }

      const perSchool = await Promise.all(
        ctx.tenancy.schools.map(async (s) => {
          const { db } = dbForSchool(ctx.tenancy, s.id);
          const docs = await db.document.findMany({ take: 500 });
          await recordAuditEvent(db, {
            tenantId: s.id,
            userId: ctx.session.user.id,
            action: "documents.searched",
            entityType: "document",
            metadata: { query: input.query, scope: "trust" },
          });
          return { school: s, docs };
        }),
      );

      const ranked = perSchool.flatMap(({ school, docs }) =>
        rankDocuments(
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
        ).map((hit) => ({
          ...hit,
          schoolId: school.id,
          schoolName: school.name,
        })),
      );
      const hits = ranked.sort((a, b) => b.score - a.score).slice(0, 50);

      return {
        query: input.query,
        synthesis: synthesise(input.query, hits),
        hits,
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
        // A styled, sealed rendering of the document, shown in the reader above
        // the text. Only present for documents that carry one (demo cases).
        imageDataUrl: doc.imageDataUrl,
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
