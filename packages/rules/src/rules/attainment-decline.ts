import type { RuleDefinition, RuleResult } from "../types";

const params = {
  minDeclinePoints: 8,
  minSubjectsDeclining: 2,
};

type SubjectSeries = { subject: string; first: number; last: number; count: number };

// Assessment scores falling across multiple subjects over the year —
// a broad decline, not one bad test in one subject.
export const attainmentDecline: RuleDefinition = {
  key: "attainment-decline",
  version: 1,
  name: "Attainment decline",
  description:
    "Assessment scores have fallen materially in at least two subjects between the earliest and latest assessments on record.",
  params,
  async evaluate(ctx): Promise<RuleResult[]> {
    const records = await ctx.db.attainmentRecord.findMany({
      select: { pupilId: true, subject: true, assessedAt: true, score: true },
      orderBy: { assessedAt: "asc" },
    });

    const byPupil = new Map<string, Map<string, SubjectSeries>>();
    let windowStart = ctx.asOf;
    for (const record of records) {
      if (record.assessedAt < windowStart) windowStart = record.assessedAt;
      const subjects = byPupil.get(record.pupilId) ?? new Map<string, SubjectSeries>();
      const series = subjects.get(record.subject);
      if (series) {
        series.last = record.score;
        series.count += 1;
      } else {
        subjects.set(record.subject, {
          subject: record.subject,
          first: record.score,
          last: record.score,
          count: 1,
        });
      }
      byPupil.set(record.pupilId, subjects);
    }

    const results: RuleResult[] = [];
    for (const [pupilId, subjects] of byPupil) {
      const series = [...subjects.values()].filter((s) => s.count >= 2);
      const declining = series.filter(
        (s) => s.first - s.last >= params.minDeclinePoints,
      );
      if (declining.length < params.minSubjectsDeclining) continue;

      const averageDecline =
        declining.reduce((sum, s) => sum + (s.first - s.last), 0) / declining.length;
      const severity = averageDecline >= 18 ? 3 : averageDecline >= 12 ? 2 : 1;

      results.push({
        pupilId,
        severity,
        title: `Scores falling in ${declining.length} subjects`,
        reasoning: {
          summary:
            `Scores have fallen by ${params.minDeclinePoints}+ points in ` +
            `${declining.map((s) => s.subject).join(", ")} between the earliest and ` +
            `latest assessments — an average decline of ${Math.round(averageDecline)} points.`,
          metrics: {
            subjectsDeclining: declining.length,
            averageDeclinePoints: Math.round(averageDecline * 10) / 10,
            thresholdDeclinePoints: params.minDeclinePoints,
            thresholdSubjects: params.minSubjectsDeclining,
          },
          dataPoints: series.map((s) => ({
            label: `${s.subject}: ${s.first} → ${s.last} over ${s.count} assessments`,
            value: s.last - s.first,
          })),
        },
        windowStart,
        windowEnd: ctx.asOf,
      });
    }
    return results;
  },
};
