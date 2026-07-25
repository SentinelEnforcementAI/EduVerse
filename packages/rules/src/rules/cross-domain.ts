import {
  attendanceCountsByPupil,
  attendanceRate,
  daysBefore,
} from "../helpers";
import type { RuleDefinition, RuleResult } from "../types";

const defaults = {
  recentDays: 28,
  baselineDays: 84,
  behaviourRecentDays: 30,
  minAttendanceDropPp: 8,
  minRecentIncidents: 3,
  minAttainmentDeclinePoints: 5,
  minDomains: 2,
};

// Moderate deterioration across several domains at once. Each individual
// change may sit below its single-domain threshold — the correlation is the
// signal. This is the pattern single-system views miss.
export const crossDomain: RuleDefinition = {
  key: "cross-domain",
  version: 1,
  name: "Cross-domain correlation",
  description:
    "Moderate deterioration in at least two of attendance, behaviour, and attainment at the same time.",
  params: defaults,
  async evaluate(ctx, params = defaults): Promise<RuleResult[]> {
    const windowEnd = ctx.asOf;
    const recentStart = daysBefore(windowEnd, params.recentDays);
    const baselineStart = daysBefore(recentStart, params.baselineDays);
    const behaviourStart = daysBefore(windowEnd, params.behaviourRecentDays);

    // Attendance drop per pupil.
    const recent = await attendanceCountsByPupil(ctx, recentStart, windowEnd);
    const baseline = await attendanceCountsByPupil(ctx, baselineStart, recentStart);
    const attendanceDropPp = new Map<string, number>();
    for (const [pupilId, recentCounts] of recent) {
      const recentRate = attendanceRate(recentCounts);
      const baselineRate = attendanceRate(baseline.get(pupilId));
      if (recentRate === null || baselineRate === null) continue;
      attendanceDropPp.set(pupilId, (baselineRate - recentRate) * 100);
    }

    // Recent behaviour incidents per pupil.
    const incidents = await ctx.db.behaviourIncident.groupBy({
      by: ["pupilId"],
      where: { date: { gte: behaviourStart, lt: windowEnd } },
      _count: { _all: true },
    });
    const incidentCounts = new Map(incidents.map((i) => [i.pupilId, i._count._all]));

    // Attainment decline per pupil (average first→last across subjects).
    const attainment = await ctx.db.attainmentRecord.findMany({
      select: { pupilId: true, subject: true, assessedAt: true, score: true },
      orderBy: { assessedAt: "asc" },
    });
    const firstLast = new Map<string, Map<string, { first: number; last: number; count: number }>>();
    for (const record of attainment) {
      const subjects = firstLast.get(record.pupilId) ?? new Map();
      const series = subjects.get(record.subject);
      if (series) {
        series.last = record.score;
        series.count += 1;
      } else {
        subjects.set(record.subject, { first: record.score, last: record.score, count: 1 });
      }
      firstLast.set(record.pupilId, subjects);
    }
    const attainmentDecline = new Map<string, number>();
    for (const [pupilId, subjects] of firstLast) {
      const series = [...subjects.values()].filter((s) => s.count >= 2);
      if (series.length === 0) continue;
      const average =
        series.reduce((sum, s) => sum + (s.first - s.last), 0) / series.length;
      attainmentDecline.set(pupilId, average);
    }

    const pupilIds = new Set([
      ...attendanceDropPp.keys(),
      ...incidentCounts.keys(),
      ...attainmentDecline.keys(),
    ]);

    const results: RuleResult[] = [];
    for (const pupilId of pupilIds) {
      const drop = attendanceDropPp.get(pupilId) ?? 0;
      const recentIncidents = incidentCounts.get(pupilId) ?? 0;
      const decline = attainmentDecline.get(pupilId) ?? 0;

      const domains = [
        drop >= params.minAttendanceDropPp,
        recentIncidents >= params.minRecentIncidents,
        decline >= params.minAttainmentDeclinePoints,
      ].filter(Boolean).length;
      if (domains < params.minDomains) continue;

      results.push({
        pupilId,
        severity: domains === 3 ? 3 : 2,
        title: `Deterioration across ${domains} domains`,
        reasoning: {
          summary:
            `Moderate deterioration in ${domains} domains at once: attendance ` +
            `down ${Math.round(drop)} percentage points, ${recentIncidents} behaviour ` +
            `incidents in the last ${params.behaviourRecentDays} days, and scores ` +
            `down an average of ${Math.round(decline)} points. Individually these ` +
            `may sit below single-domain thresholds — together they warrant a look.`,
          metrics: {
            attendanceDropPp: Math.round(drop * 10) / 10,
            recentBehaviourIncidents: recentIncidents,
            averageAttainmentDecline: Math.round(decline * 10) / 10,
            domainsAffected: domains,
            thresholdDomains: params.minDomains,
          },
          dataPoints: [
            {
              label: `Attendance drop vs threshold (${params.minAttendanceDropPp}pp)`,
              value: `${Math.round(drop * 10) / 10}pp`,
            },
            {
              label: `Behaviour incidents vs threshold (${params.minRecentIncidents})`,
              value: recentIncidents,
            },
            {
              label: `Average score decline vs threshold (${params.minAttainmentDeclinePoints})`,
              value: Math.round(decline * 10) / 10,
            },
          ],
        },
        windowStart: baselineStart,
        windowEnd,
      });
    }
    return results;
  },
};
