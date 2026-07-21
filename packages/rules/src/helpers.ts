import type { RuleContext } from "./types";

export function daysBefore(asOf: Date, days: number): Date {
  return new Date(asOf.getTime() - days * 86_400_000);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 10;
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type AttendanceCounts = { present: number; absent: number };

// Present/absent session counts per pupil within [from, to).
export async function attendanceCountsByPupil(
  ctx: RuleContext,
  from: Date,
  to: Date,
): Promise<Map<string, AttendanceCounts>> {
  const grouped = await ctx.db.attendanceRecord.groupBy({
    by: ["pupilId", "present"],
    where: { date: { gte: from, lt: to } },
    _count: { _all: true },
  });
  const counts = new Map<string, AttendanceCounts>();
  for (const row of grouped) {
    const entry = counts.get(row.pupilId) ?? { present: 0, absent: 0 };
    if (row.present) entry.present += row._count._all;
    else entry.absent += row._count._all;
    counts.set(row.pupilId, entry);
  }
  return counts;
}

export function attendanceRate(counts: AttendanceCounts | undefined): number | null {
  if (!counts) return null;
  const total = counts.present + counts.absent;
  return total === 0 ? null : counts.present / total;
}
