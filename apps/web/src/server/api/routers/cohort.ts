import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { TenantDb } from "@sentinel/db";

import {
  createTRPCRouter,
  dbForSchool,
  tenancyProcedure,
} from "@/server/api/trpc";

// Cross-school cohort intelligence (spec 5.3). Watch looks across the trust for
// patterns that cross school boundaries: the same kind of concern, in the same
// year group, showing up in more than one school at once. Computed from real
// signals, sealed (counts only, never a pupil).

type Domain = { key: string; label: string };

function domainOf(ruleKey: string): Domain {
  if (ruleKey.startsWith("attendance") || ruleKey.startsWith("sustained"))
    return { key: "attendance", label: "attendance" };
  if (ruleKey.startsWith("behaviour"))
    return { key: "behaviour", label: "behaviour" };
  if (ruleKey.startsWith("attainment"))
    return { key: "attainment", label: "attainment" };
  if (ruleKey.startsWith("cross") || ruleKey.startsWith("demo"))
    return { key: "cross-domain", label: "cross-domain" };
  return { key: "wellbeing", label: "wellbeing" };
}

const RECOMMENDATION: Record<string, string> = {
  attendance:
    "Coordinate an attendance focus across the affected schools for this year group, and check whether a shared cause (transport, a local event, term timing) is in play before treating each school separately.",
  behaviour:
    "Review behaviour and pastoral support for this year group across the schools together. A trust-wide pattern often reflects a shared transition or curriculum pressure rather than individual conduct.",
  attainment:
    "Look at attainment support for this cohort across the schools. A common dip can point to a shared gap that a coordinated intervention addresses more efficiently than five separate ones.",
  "cross-domain":
    "These are linked, multi-domain concerns appearing across schools. Convene a trust safeguarding view for this cohort and consider whether Early Help capacity should be shared.",
  wellbeing:
    "Consider a coordinated wellbeing response for this year group across the schools, and check whether counselling or pastoral capacity should be pooled.",
};

type SignalRow = { yearGroup: number; ruleKey: string };

async function schoolSignals(db: TenantDb): Promise<SignalRow[]> {
  const signals = await db.signal.findMany({
    where: { status: { in: ["OPEN", "CONFIRMED", "ESCALATED"] } },
    select: {
      pupilId: true,
      ruleVersion: { select: { key: true } },
    },
    take: 1000,
  });
  // Resolve the pupil separately, under the same RLS context, and skip any
  // signal whose pupil is not readable here. A signal's pupil is a required
  // relation, so including it inline makes Prisma throw the whole query if one
  // row's pupil is unreadable (e.g. a cross-tenant leftover) — that must never
  // take down a page full of children's signals. One odd row is dropped, not
  // the view.
  const pupilIds = [...new Set(signals.map((s) => s.pupilId))];
  const pupils = await db.pupil.findMany({
    where: { id: { in: pupilIds } },
    select: { id: true, yearGroup: true },
  });
  const yearById = new Map(pupils.map((p) => [p.id, p.yearGroup]));
  return signals.flatMap((s) => {
    const yearGroup = yearById.get(s.pupilId);
    return yearGroup === undefined ? [] : [{ yearGroup, ruleKey: s.ruleVersion.key }];
  });
}

type Aggregate = {
  key: string;
  yearGroup: number;
  domain: Domain;
  schools: Map<string, number>;
};

async function aggregate(
  tenancy: Parameters<typeof dbForSchool>[0],
  schools: { id: string; name: string }[],
): Promise<Map<string, Aggregate>> {
  const byKey = new Map<string, Aggregate>();
  for (const school of schools) {
    const { db } = dbForSchool(tenancy, school.id);
    const rows = await schoolSignals(db);
    for (const row of rows) {
      const domain = domainOf(row.ruleKey);
      const key = `${row.yearGroup}-${domain.key}`;
      let agg = byKey.get(key);
      if (!agg) {
        agg = { key, yearGroup: row.yearGroup, domain, schools: new Map() };
        byKey.set(key, agg);
      }
      agg.schools.set(school.name, (agg.schools.get(school.name) ?? 0) + 1);
    }
  }
  return byKey;
}

export const cohortRouter = createTRPCRouter({
  // The cross-school patterns worth investigating: same concern and year group
  // in two or more schools. Director-only.
  patterns: tenancyProcedure.query(async ({ ctx }) => {
    if (ctx.tenancy.mode !== "mat") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const byKey = await aggregate(ctx.tenancy, ctx.tenancy.schools);
    const patterns = [...byKey.values()]
      .filter((a) => a.schools.size >= 2)
      .map((a) => {
        const pupils = [...a.schools.values()].reduce((n, c) => n + c, 0);
        return {
          key: a.key,
          title: `Year ${a.yearGroup} ${a.domain.label} concerns across ${a.schools.size} schools`,
          detail: `${pupils} pupils flagged across ${a.schools.size} schools`,
          schools: a.schools.size,
          pupils,
        };
      })
      .sort((x, y) => y.schools - x.schools || y.pupils - x.pupils)
      .slice(0, 6);
    return { patterns };
  }),

  // One cross-school pattern in detail: the by-school breakdown and what Watch
  // recommends. Director-only.
  detail: tenancyProcedure
    .input(z.object({ key: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      if (ctx.tenancy.mode !== "mat") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const byKey = await aggregate(ctx.tenancy, ctx.tenancy.schools);
      const agg = byKey.get(input.key);
      if (!agg) throw new TRPCError({ code: "NOT_FOUND" });

      const rows = [...agg.schools.entries()]
        .map(([school, count]) => ({ school, count }))
        .sort((a, b) => b.count - a.count);
      const pupils = rows.reduce((n, r) => n + r.count, 0);

      return {
        title: `Year ${agg.yearGroup} ${agg.domain.label} concerns`,
        summary: `Watch has surfaced ${pupils} ${agg.domain.label} concerns in Year ${agg.yearGroup} across ${rows.length} schools in the same period. Individually each school might treat this as local; together it reads as a cohort pattern.`,
        rows,
        recommendation:
          RECOMMENDATION[agg.domain.key] ?? RECOMMENDATION.wellbeing!,
      };
    }),
});
