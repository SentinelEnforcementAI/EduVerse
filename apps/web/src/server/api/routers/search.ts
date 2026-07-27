import { z } from "zod";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";
import { escalationLevel, type EscalationLevel } from "@/server/escalation";
import { sealPupilRef } from "@/server/identity";

// Global search across the caller's scope. Sealed by construction: a concern
// result carries a reference, a level and a one-line reason, never a name. A
// director searches across their trust's schools; a DSL within their own.
// Matches a sealed reference (its number), a concern's headline, or a school
// name — the things visible on the surfaces, nothing identifying.

export type SchoolHit = { id: string; name: string };
export type ConcernHit = {
  id: string;
  schoolId: string;
  schoolName: string;
  ref: string;
  yearGroup: number;
  headline: string;
  level: EscalationLevel;
};

export const searchRouter = createTRPCRouter({
  query: tenancyProcedure
    .input(z.object({ q: z.string().max(120) }))
    .query(async ({ ctx, input }) => {
      const q = input.q.trim().toLowerCase();
      if (q.length < 2) {
        return { q: input.q.trim(), schools: [], concerns: [] };
      }

      const schools: SchoolHit[] = ctx.tenancy.schools
        .filter((s) => s.name.toLowerCase().includes(q))
        .map((s) => ({ id: s.id, name: s.name }));

      // Concerns: live signals whose sealed reference number or headline matches.
      // Reference is derived server-side, so we compute it per candidate and
      // filter — the raw UPN is never exposed.
      const perSchool = await Promise.all(
        ctx.tenancy.schools.map(async (s) => {
          const { db } = dbForSchool(ctx.tenancy, s.id);
          const signals = await db.signal.findMany({
            where: { status: { in: ["OPEN", "CONFIRMED", "ESCALATED"] } },
            select: {
              id: true,
              title: true,
              severity: true,
              serious: true,
              pupilId: true,
            },
            orderBy: [
              { serious: "desc" },
              { severity: "desc" },
              { updatedAt: "desc" },
            ],
            take: 400,
          });
          // Resolve pupils separately under the same RLS context and skip any
          // signal whose pupil is unreadable here — a required relation included
          // inline would make Prisma throw the whole query for one odd (e.g.
          // cross-tenant) row.
          const pupils = await db.pupil.findMany({
            where: { id: { in: [...new Set(signals.map((sig) => sig.pupilId))] } },
            select: { id: true, upn: true, yearGroup: true },
          });
          const byId = new Map(pupils.map((p) => [p.id, p]));
          return signals
            .flatMap((sig) => {
              const pupil = byId.get(sig.pupilId);
              if (!pupil) return [];
              return [
                {
                  id: sig.id,
                  schoolId: s.id,
                  schoolName: s.name,
                  ref: sealPupilRef(pupil.upn),
                  yearGroup: pupil.yearGroup,
                  headline: sig.title,
                  level: escalationLevel(sig.severity, sig.serious),
                },
              ];
            })
            .filter(
              (r) =>
                r.ref.toLowerCase().includes(q) ||
                r.headline.toLowerCase().includes(q),
            );
        }),
      );

      const concerns = perSchool
        .flat()
        .sort((a, b) => b.level - a.level)
        .slice(0, 25);

      return { q: input.q.trim(), schools, concerns };
    }),
});
