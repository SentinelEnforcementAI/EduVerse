"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, School, Search, ShieldQuestion, Zap } from "lucide-react";

import { LEVEL_COLOR, type EscalationLevel } from "@/server/escalation";

import { LevelChip } from "../shell/level-chip";

export type AlertRow = {
  id: string;
  schoolId: string;
  schoolName: string;
  ref: string;
  yearGroup: number;
  headline: string;
  level: EscalationLevel;
  domain: string;
  signalCount: number;
  surfacedAt: string;
  waitingMs: number;
};

function waitingLabel(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

// An absolute "Since 16 May, 09:12" for the moment the concern reached the
// action threshold — the honest anchor beneath the relative wait.
function sinceLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const selectClass =
  "rounded-lg border border-[var(--card-border)] bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// The alerts inbox as a prioritised decision queue. Statutory concerns are
// always pinned above targeted support; the reader can filter and search, but
// each decision stays intentionally individual (no bulk actions). Sealed — a
// reference, a level, a reason, never a name.
export function AlertsQueue({ alerts }: { alerts: AlertRow[] }) {
  const [school, setSchool] = useState("");
  const [level, setLevel] = useState("");
  const [year, setYear] = useState("");
  const [domain, setDomain] = useState("");
  const [sort, setSort] = useState<"waiting" | "newest" | "level">("level");
  const [q, setQ] = useState("");

  const schools = useMemo(
    () =>
      [...new Map(alerts.map((a) => [a.schoolId, a.schoolName])).entries()].sort(
        (a, b) => a[1].localeCompare(b[1]),
      ),
    [alerts],
  );
  const years = useMemo(
    () => [...new Set(alerts.map((a) => a.yearGroup))].sort((a, b) => a - b),
    [alerts],
  );
  const domains = useMemo(
    () => [...new Set(alerts.map((a) => a.domain))].sort(),
    [alerts],
  );

  const statutory = alerts.filter((a) => a.level === 4).length;
  const targeted = alerts.filter((a) => a.level === 3).length;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = alerts.filter(
      (a) =>
        (!school || a.schoolId === school) &&
        (!level || a.level === Number(level)) &&
        (!year || a.yearGroup === Number(year)) &&
        (!domain || a.domain === domain) &&
        (!needle ||
          a.ref.toLowerCase().includes(needle) ||
          a.headline.toLowerCase().includes(needle)),
    );
    // Statutory always leads; the chosen sort orders within a level band.
    return rows.sort(
      (a, b) =>
        b.level - a.level ||
        (sort === "waiting"
          ? b.waitingMs - a.waitingMs
          : sort === "newest"
            ? a.waitingMs - b.waitingMs
            : 0),
    );
  }, [alerts, school, level, year, domain, q, sort]);

  return (
    <div>
      {/* Summary row */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="text-lg font-semibold tabular-nums">
            {alerts.length.toLocaleString("en-GB")}
          </span>{" "}
          <span className="text-muted-foreground">awaiting decision</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-risk" />
          <span className="font-semibold tabular-nums">{statutory}</span>
          <span className="text-muted-foreground">statutory</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-warning" />
          <span className="font-semibold tabular-nums">{targeted}</span>
          <span className="text-muted-foreground">targeted support</span>
        </span>
        <Link
          href="/dashboard/governance"
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-cobalt hover:underline"
        >
          <ShieldQuestion className="size-4" aria-hidden />
          Alerts policy &amp; guidance
        </Link>
      </div>

      {/* Filters + search */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search pupil reference or concern"
            className="w-full rounded-lg border border-[var(--card-border)] bg-card py-2 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          aria-label="School"
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          className={selectClass}
        >
          <option value="">All schools</option>
          {schools.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Escalation level"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className={selectClass}
        >
          <option value="">All levels</option>
          <option value="4">L4 Statutory threshold</option>
          <option value="3">L3 Targeted support</option>
        </select>
        <select
          aria-label="Year group"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={selectClass}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              Year {y}
            </option>
          ))}
        </select>
        <select
          aria-label="Domain"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className={selectClass}
        >
          <option value="">All domains</option>
          {domains.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className={selectClass}
        >
          <option value="level">Highest level</option>
          <option value="waiting">Longest waiting</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-4 rounded-[14px] border border-[var(--card-border)] bg-card p-6 text-sm text-muted-foreground">
          No concerns match these filters.
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((a) => {
            const statutoryRow = a.level === 4;
            return (
              <li key={a.id}>
                <Link
                  href={`/dashboard/school/${a.schoolId}/case/${a.id}`}
                  style={{ borderLeftColor: LEVEL_COLOR[a.level] }}
                  className={`flex items-center gap-4 rounded-[14px] border border-[var(--card-border)] border-l-[3px] px-4 py-3 shadow-[var(--shadow-card)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statutoryRow ? "bg-[#fff8f8] hover:bg-[#fff1f1]" : "bg-card hover:bg-paper"}`}
                >
                  <LevelChip
                    level={a.level}
                    className="hidden w-44 justify-center sm:inline-flex"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {a.ref}
                      <span className="font-normal text-muted-foreground">
                        · Year {a.yearGroup}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        <School className="size-3" aria-hidden />
                        {a.schoolName}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {a.headline}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-medium text-ink">
                        <Zap
                          className="size-3.5 text-cobalt"
                          aria-hidden
                          fill="currentColor"
                        />
                        {a.signalCount} contributing{" "}
                        {a.signalCount === 1 ? "signal" : "signals"}
                      </span>
                      <span>{a.domain}</span>
                    </div>
                  </div>
                  <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                    <span className="text-xs font-medium text-ink">
                      Waiting {waitingLabel(a.waitingMs)}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      Since {sinceLabel(a.surfacedAt)}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-lg border border-cobalt/30 px-2.5 py-1 text-xs font-medium text-cobalt">
                      Review
                      <ChevronRight className="size-3.5" aria-hidden />
                    </span>
                  </div>
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground sm:hidden"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
