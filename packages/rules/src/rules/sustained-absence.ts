import { daysBefore, isoDate, WEEKDAY_NAMES } from "../helpers";
import type { RuleDefinition, RuleResult } from "../types";

const params = {
  windowDays: 84,
  minWeekdayAbsenceRatePct: 50,
  minWeekdayOccurrences: 8,
  maxOtherWeekdayAbsenceRatePct: 20,
};

// The classic pattern absence: one specific weekday habitually missed while
// the rest of the week looks normal. Overall attendance can still look
// acceptable, which is exactly why this needs its own rule.
export const sustainedAbsence: RuleDefinition = {
  key: "sustained-absence",
  version: 1,
  name: "Sustained absence pattern",
  description:
    "One weekday is habitually missed over the last twelve weeks while attendance on other weekdays remains normal.",
  params,
  async evaluate(ctx): Promise<RuleResult[]> {
    const windowEnd = ctx.asOf;
    const windowStart = daysBefore(windowEnd, params.windowDays);

    // School days actually in the register for this window (AM sessions).
    const dates = await ctx.db.attendanceRecord.findMany({
      where: { date: { gte: windowStart, lt: windowEnd }, session: "AM" },
      select: { date: true },
      distinct: ["date"],
    });
    const weekdayTotals = new Map<number, number>();
    for (const { date } of dates) {
      const dow = date.getUTCDay();
      weekdayTotals.set(dow, (weekdayTotals.get(dow) ?? 0) + 1);
    }

    // AM absences per pupil per weekday (a missed day registers at AM).
    const absences = await ctx.db.attendanceRecord.findMany({
      where: {
        date: { gte: windowStart, lt: windowEnd },
        session: "AM",
        present: false,
      },
      select: { pupilId: true, date: true },
    });
    const byPupil = new Map<string, Map<number, Date[]>>();
    for (const absence of absences) {
      const weekdays = byPupil.get(absence.pupilId) ?? new Map<number, Date[]>();
      const dow = absence.date.getUTCDay();
      const list = weekdays.get(dow) ?? [];
      list.push(absence.date);
      weekdays.set(dow, list);
      byPupil.set(absence.pupilId, weekdays);
    }

    const results: RuleResult[] = [];
    for (const [pupilId, weekdays] of byPupil) {
      for (const [dow, dateList] of weekdays) {
        const total = weekdayTotals.get(dow) ?? 0;
        if (total < params.minWeekdayOccurrences) continue;
        const rate = (dateList.length / total) * 100;
        if (rate < params.minWeekdayAbsenceRatePct) continue;

        let otherAbsent = 0;
        let otherTotal = 0;
        for (const [otherDow, otherCount] of weekdayTotals) {
          if (otherDow === dow) continue;
          otherTotal += otherCount;
          otherAbsent += weekdays.get(otherDow)?.length ?? 0;
        }
        const otherRate = otherTotal === 0 ? 0 : (otherAbsent / otherTotal) * 100;
        if (otherRate > params.maxOtherWeekdayAbsenceRatePct) continue;

        const weekdayName = WEEKDAY_NAMES[dow]!;
        const severity: 1 | 2 | 3 =
          rate >= 75 && dateList.length >= 10 ? 3 : 2;

        results.push({
          pupilId,
          severity,
          title: `Absent ${dateList.length} of ${total} ${weekdayName}s`,
          reasoning: {
            summary:
              `Absent on ${dateList.length} of the last ${total} ${weekdayName}s ` +
              `(${Math.round(rate)}%), while absence on other weekdays is ` +
              `${Math.round(otherRate)}%. A recurring same-day pattern like this ` +
              `often has a specific cause.`,
            metrics: {
              weekday: weekdayName,
              weekdayAbsenceRatePct: Math.round(rate),
              otherWeekdayAbsenceRatePct: Math.round(otherRate),
              thresholdWeekdayRatePct: params.minWeekdayAbsenceRatePct,
            },
            dataPoints: dateList
              .sort((a, b) => b.getTime() - a.getTime())
              .slice(0, 15)
              .map((date) => ({
                label: `${weekdayName} absence`,
                date: isoDate(date),
                value: weekdayName,
              })),
          },
          windowStart,
          windowEnd,
        });
        break; // one signal per pupil for this rule
      }
    }
    return results;
  },
};
