// Parse the concerns-list filter values out of the URL search params, shared by
// the trust and school triage pages. Invalid values are simply dropped, so a
// hand-edited URL can never throw — the tRPC input schema validates again.

type Params = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length ? s : undefined;
}

function num(v: string | string[] | undefined): number | undefined {
  const s = str(v);
  if (s === undefined) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

type Status = "OPEN" | "CONFIRMED" | "ESCALATED";

function parseStatus(v: string | string[] | undefined): Status | undefined {
  const s = str(v);
  return s === "OPEN" || s === "CONFIRMED" || s === "ESCALATED" ? s : undefined;
}

export function parseTriageFilters(params: Params) {
  return {
    schoolId: str(params.schoolId),
    yearGroup: num(params.yearGroup),
    domain: str(params.domain),
    level: num(params.level),
    status: parseStatus(params.status),
    cohort: str(params.cohort),
  };
}
