"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

// Filter bar for the concerns list. Each control writes its value to the URL
// query string, so the server component re-runs the (RLS-scoped) query with the
// filter applied — shareable links, back-button friendly, no client-side data.
// The school filter only appears at trust scope; a DSL is already one school.

export type TriageFacets = {
  schools: { id: string; name: string }[];
  years: number[];
  domains: { key: string; label: string }[];
  levels: number[];
  cohorts: { key: string; label: string }[];
  statuses: string[];
};

export type TriageApplied = {
  schoolId: string | null;
  yearGroup: number | null;
  domain: string | null;
  level: number | null;
  status: string | null;
  cohort: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Awaiting decision",
  CONFIRMED: "Confirmed",
  ESCALATED: "Escalated",
};

const LEVEL_LABEL: Record<number, string> = {
  1: "L1 Monitor",
  2: "L2 Emerging",
  3: "L3 Targeted",
  4: "L4 Statutory",
};

export function TriageFilters({
  facets,
  applied,
  showSchool,
  shown,
  total,
}: {
  facets: TriageFacets;
  applied: TriageApplied;
  showSchool: boolean;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const hasFilters =
    applied.schoolId ||
    applied.yearGroup ||
    applied.domain ||
    applied.level ||
    applied.status ||
    applied.cohort;

  const selectClass =
    "rounded-lg border border-cloud bg-card px-2.5 py-1.5 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      {showSchool && facets.schools.length > 1 ? (
        <select
          aria-label="Filter by school"
          className={selectClass}
          value={applied.schoolId ?? ""}
          onChange={(e) => setParam("schoolId", e.target.value)}
        >
          <option value="">All schools</option>
          {facets.schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : null}

      {facets.years.length > 1 ? (
        <select
          aria-label="Filter by year group"
          className={selectClass}
          value={applied.yearGroup ?? ""}
          onChange={(e) => setParam("yearGroup", e.target.value)}
        >
          <option value="">All years</option>
          {facets.years.map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </select>
      ) : null}

      {facets.domains.length > 1 ? (
        <select
          aria-label="Filter by concern type"
          className={selectClass}
          value={applied.domain ?? ""}
          onChange={(e) => setParam("domain", e.target.value)}
        >
          <option value="">All concern types</option>
          {facets.domains.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
      ) : null}

      {facets.levels.length > 1 ? (
        <select
          aria-label="Filter by escalation level"
          className={selectClass}
          value={applied.level ?? ""}
          onChange={(e) => setParam("level", e.target.value)}
        >
          <option value="">All levels</option>
          {facets.levels.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l] ?? `Level ${l}`}
            </option>
          ))}
        </select>
      ) : null}

      {facets.statuses.length > 1 ? (
        <select
          aria-label="Filter by status"
          className={selectClass}
          value={applied.status ?? ""}
          onChange={(e) => setParam("status", e.target.value)}
        >
          <option value="">Any status</option>
          {facets.statuses.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s] ?? s}
            </option>
          ))}
        </select>
      ) : null}

      {facets.cohorts.length > 0 ? (
        <select
          aria-label="Filter by safeguarding context"
          className={selectClass}
          value={applied.cohort ?? ""}
          onChange={(e) => setParam("cohort", e.target.value)}
        >
          <option value="">Any context</option>
          {facets.cohorts.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      ) : null}

      {hasFilters ? (
        <button
          type="button"
          onClick={() => router.push(pathname, { scroll: false })}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-cobalt hover:bg-cobalt-tint"
        >
          <X className="size-3.5" aria-hidden />
          Clear
        </button>
      ) : null}

      <span className="ml-auto text-sm text-muted-foreground">
        {hasFilters ? `${shown} of ${total}` : `${total}`}{" "}
        {total === 1 ? "case" : "cases"}
      </span>
    </div>
  );
}
