import {
  attendanceCountsByPupil,
  attendanceRate,
  daysBefore,
  isoDate,
  pct,
} from "../helpers";
import type { RuleDefinition, RuleResult } from "../types";

const defaults = {
  recentDays: 28,
  baselineDays: 84,
  minDropPercentagePoints: 15,
  maxRecentRatePct: 85,
  minBaselineSessions: 30,
  minRecentSessions: 16,
};

// Attendance in the recent window has fallen sharply against the pupil's own
// baseline. Severity scales with the size of the drop.
export const attendanceDrop: RuleDefinition = {
  key: "attendance-drop",
  version: 1,
  name: "Attendance drop",
  description:
    "Attendance rate over the last four weeks has dropped sharply against the pupil's previous twelve-week baseline.",
  params: defaults,
  async evaluate(ctx, params = defaults): Promise<RuleResult[]> {
    const windowEnd = ctx.asOf;
    const recentStart = daysBefore(windowEnd, params.recentDays);
    const baselineStart = daysBefore(recentStart, params.baselineDays);

    const recent = await attendanceCountsByPupil(ctx, recentStart, windowEnd);
    const baseline = await attendanceCountsByPupil(ctx, baselineStart, recentStart);

    const results: RuleResult[] = [];
    for (const [pupilId, recentCounts] of recent) {
      const baselineCounts = baseline.get(pupilId);
      const recentRate = attendanceRate(recentCounts);
      const baselineRate = attendanceRate(baselineCounts);
      if (recentRate === null || baselineRate === null) continue;
      if (recentCounts.present + recentCounts.absent < params.minRecentSessions) continue;
      if (
        (baselineCounts!.present + baselineCounts!.absent) <
        params.minBaselineSessions
      )
        continue;

      const dropPp = (baselineRate - recentRate) * 100;
      const recentPct = recentRate * 100;
      if (dropPp < params.minDropPercentagePoints || recentPct > params.maxRecentRatePct) {
        continue;
      }

      const severity = dropPp >= 30 ? 3 : dropPp >= 22 ? 2 : 1;
      const recentAbsences = await ctx.db.attendanceRecord.findMany({
        where: { pupilId, present: false, date: { gte: recentStart, lt: windowEnd } },
        orderBy: { date: "desc" },
        take: 20,
        select: { date: true, session: true, code: true, authorised: true },
      });

      results.push({
        pupilId,
        severity,
        title: `Attendance dropped ${Math.round(dropPp)} percentage points`,
        reasoning: {
          summary:
            `Attendance over the last ${params.recentDays} days is ` +
            `${pct(recentCounts.present, recentCounts.present + recentCounts.absent)}%, ` +
            `against a baseline of ` +
            `${pct(baselineCounts!.present, baselineCounts!.present + baselineCounts!.absent)}% ` +
            `over the preceding ${params.baselineDays} days — a drop of ` +
            `${Math.round(dropPp)} percentage points.`,
          metrics: {
            recentRatePct: Math.round(recentPct * 10) / 10,
            baselineRatePct: Math.round(baselineRate * 1000) / 10,
            dropPercentagePoints: Math.round(dropPp * 10) / 10,
            thresholdDropPercentagePoints: params.minDropPercentagePoints,
          },
          dataPoints: recentAbsences.map((a) => ({
            label: `${a.session} absence (code ${a.code}${a.authorised ? ", authorised" : ", unauthorised"})`,
            date: isoDate(a.date),
            value: a.code,
          })),
        },
        windowStart: recentStart,
        windowEnd,
      });
    }
    return results;
  },
};
