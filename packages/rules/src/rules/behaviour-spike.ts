import { daysBefore, isoDate } from "../helpers";
import type { RuleDefinition, RuleResult } from "../types";

const defaults = {
  // Six school weeks in calendar days — matches the "recent cluster" the
  // rule describes.
  recentDays: 42,
  baselineDays: 90,
  minRecentIncidents: 4,
  minRatioToBaseline: 2.5,
};

// A cluster of behaviour incidents in the last month, out of line with the
// pupil's own prior rate. Severity scales with severity-weighted volume.
export const behaviourSpike: RuleDefinition = {
  key: "behaviour-spike",
  version: 1,
  name: "Behaviour spike",
  description:
    "Behaviour incidents in the last six school weeks far exceed the pupil's previous quarterly rate.",
  params: defaults,
  async evaluate(ctx, params = defaults): Promise<RuleResult[]> {
    const windowEnd = ctx.asOf;
    const recentStart = daysBefore(windowEnd, params.recentDays);
    const baselineStart = daysBefore(recentStart, params.baselineDays);

    const incidents = await ctx.db.behaviourIncident.findMany({
      where: { date: { gte: baselineStart, lt: windowEnd } },
      select: { pupilId: true, date: true, category: true, severity: true, description: true },
      orderBy: { date: "desc" },
    });

    const byPupil = new Map<string, typeof incidents>();
    for (const incident of incidents) {
      const list = byPupil.get(incident.pupilId) ?? [];
      list.push(incident);
      byPupil.set(incident.pupilId, list);
    }

    const results: RuleResult[] = [];
    for (const [pupilId, list] of byPupil) {
      const recent = list.filter((i) => i.date >= recentStart);
      const prior = list.filter((i) => i.date < recentStart);
      if (recent.length < params.minRecentIncidents) continue;

      const priorMonthlyAverage = prior.length / (params.baselineDays / 30);
      const ratio = recent.length / Math.max(priorMonthlyAverage, 1);
      if (ratio < params.minRatioToBaseline) continue;

      const weighted = recent.reduce((sum, i) => sum + i.severity, 0);
      const severity = weighted >= 14 ? 3 : weighted >= 8 ? 2 : 1;

      results.push({
        pupilId,
        severity,
        title: `${recent.length} behaviour incidents in six school weeks`,
        reasoning: {
          summary:
            `${recent.length} incidents in the last ${params.recentDays} days, against ` +
            `an average of ${Math.round(priorMonthlyAverage * 10) / 10} per month over the ` +
            `preceding ${params.baselineDays} days.`,
          metrics: {
            recentIncidents: recent.length,
            priorMonthlyAverage: Math.round(priorMonthlyAverage * 10) / 10,
            severityWeightedTotal: weighted,
            thresholdRecentIncidents: params.minRecentIncidents,
          },
          dataPoints: recent.slice(0, 20).map((i) => ({
            label: `${i.category} (severity ${i.severity}): ${i.description}`,
            date: isoDate(i.date),
            value: i.severity,
          })),
        },
        windowStart: recentStart,
        windowEnd,
      });
    }
    return results;
  },
};
