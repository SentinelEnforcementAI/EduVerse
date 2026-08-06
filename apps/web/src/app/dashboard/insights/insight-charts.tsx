import Link from "next/link";
import { type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

// Static, server-rendered charts for the trust insights page. In the spirit of
// the app's "honest sparkline": every series is real data, every value is
// directly labelled or legended (identity is never colour-alone), magnitude
// uses a single hue (cobalt), and the escalation scale uses the level palette.
// Where a figure has an `href`, it drills through to the concerns it counts.

export function StatTile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="h-full p-4 card-interactive">
          {inner}
        </Card>
      </Link>
    );
  }
  return <Card className="p-4">{inner}</Card>;
}

// A horizontal magnitude list — length encodes the count, over a light track.
// Rows can carry a percentage, a leading icon and a `striped` treatment (used to
// mark cross-domain patterns, Sentinel's distinctive signal). A row with an
// `href` becomes a link to the concerns behind it.
export function BarList({
  rows,
  unit,
}: {
  rows: {
    label: string;
    value: number;
    note?: string;
    href?: string;
    percent?: number;
    icon?: LucideIcon;
    striped?: boolean;
  }[];
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const Icon = r.icon;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-1.5">
                {Icon ? (
                  <Icon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
                <span className="truncate group-hover:text-cobalt">{r.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <span className="font-medium text-ink">
                  {r.value.toLocaleString("en-GB")}
                </span>
                {unit ? ` ${unit}` : ""}
                {typeof r.percent === "number"
                  ? `  ${Math.round(r.percent * 100)}%`
                  : ""}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-cobalt"
                style={{
                  width: `${(r.value / max) * 100}%`,
                  ...(r.striped
                    ? {
                        backgroundImage:
                          "repeating-linear-gradient(45deg, var(--cobalt) 0 4px, color-mix(in srgb, var(--cobalt) 55%, white) 4px 8px)",
                      }
                    : {}),
                }}
              />
            </div>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link
                href={r.href}
                className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}

const LEVEL_STYLE: Record<number, { bg: string; label: string }> = {
  1: { bg: "var(--level-1)", label: "L1 Monitor" },
  2: { bg: "var(--level-2)", label: "L2 Emerging need" },
  3: { bg: "var(--level-3)", label: "L3 Targeted support" },
  4: { bg: "var(--level-4)", label: "L4 Statutory threshold" },
};

// The escalation-level mix of the active caseload: a donut on the ordinal level
// palette with the caseload total at its centre, and a labelled legend beside
// it (identity is never colour-alone). Part-to-whole, so a ring reads at a
// glance where a stacked bar only reads on inspection.
export function LevelDonut({
  mix,
}: {
  mix: { level: number; count: number; href?: string }[];
}) {
  const total = mix.reduce((n, m) => n + m.count, 0);
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const active = mix.filter((m) => m.count > 0);
  const segments = active.map((m, i) => {
    const priorCount = active
      .slice(0, i)
      .reduce((sum, p) => sum + p.count, 0);
    return {
      level: m.level,
      dash: (m.count / (total || 1)) * circumference,
      offset: (priorCount / (total || 1)) * circumference,
      count: m.count,
    };
  });
  const pct = (n: number) =>
    total === 0 ? "0%" : n / total < 0.01 ? "<1%" : `${Math.round((n / total) * 100)}%`;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
      <div className="relative size-40 shrink-0">
        <svg viewBox="0 0 100 100" className="size-40 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--cloud)"
            strokeWidth="11"
          />
          {segments.map((s) => (
            <circle
              key={s.level}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={LEVEL_STYLE[s.level]!.bg}
              strokeWidth="11"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
            >
              <title>{`${LEVEL_STYLE[s.level]!.label}: ${s.count}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-semibold tabular-nums">
            {total.toLocaleString("en-GB")}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Concerns
          </span>
        </div>
      </div>
      {/* Legend vertically centred against the ring, count + percentage, with
          the statutory row given an emphasised callout since it is often a
          sliver in the ring. */}
      <ul className="w-full space-y-1.5 self-center">
        {mix.map((m) => {
          const statutory = m.level === 4 && m.count > 0;
          const row = (
            <>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: LEVEL_STYLE[m.level]!.bg }}
              />
              <span
                className={
                  statutory
                    ? "font-medium text-ink group-hover:text-cobalt"
                    : "text-muted-foreground group-hover:text-cobalt"
                }
              >
                {LEVEL_STYLE[m.level]!.label}
              </span>
              <span className="ml-auto tabular-nums font-medium">
                {m.count.toLocaleString("en-GB")}
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-xs text-muted-foreground">
                {pct(m.count)}
              </span>
            </>
          );
          const cls = `group flex items-center gap-2 rounded-md px-2 py-1 text-sm ${statutory ? "border border-risk/30 bg-risk-tint/40" : ""}`;
          return (
            <li key={m.level}>
              {m.href ? (
                <Link
                  href={m.href}
                  className={`${cls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
                >
                  {row}
                </Link>
              ) : (
                <div className={cls}>{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Decision outcomes — the caseload's health as a proportion bar with a legend.
const OUTCOME_STYLE: { key: string; label: string; bg: string }[] = [
  { key: "open", label: "Awaiting decision", bg: "var(--cobalt)" },
  { key: "confirmed", label: "Concern confirmed", bg: "var(--success-green)" },
  { key: "escalated", label: "Escalated externally", bg: "var(--warning-amber)" },
  { key: "dismissed", label: "Dismissed with reason", bg: "var(--muted-foreground)" },
];

export function Outcomes({
  outcomes,
  hrefs,
}: {
  outcomes: { open: number; confirmed: number; escalated: number; dismissed: number };
  hrefs?: Partial<Record<"open" | "confirmed" | "escalated" | "dismissed", string>>;
}) {
  const total =
    outcomes.open + outcomes.confirmed + outcomes.escalated + outcomes.dismissed || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-paper">
        {OUTCOME_STYLE.map((o) => {
          const v = outcomes[o.key as keyof typeof outcomes];
          return v > 0 ? (
            <div
              key={o.key}
              style={{ width: `${(v / total) * 100}%`, backgroundColor: o.bg }}
              title={`${o.label}: ${v}`}
            />
          ) : null;
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OUTCOME_STYLE.map((o) => {
          const href = hrefs?.[o.key as keyof typeof outcomes];
          const row = (
            <>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: o.bg }}
              />
              <span className="text-muted-foreground group-hover:text-cobalt">
                {o.label}
              </span>
              <span className="tabular-nums font-medium">
                {outcomes[o.key as keyof typeof outcomes]}
              </span>
            </>
          );
          return (
            <li key={o.key}>
              {href ? (
                <Link
                  href={href}
                  className="group flex items-center gap-2 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {row}
                </Link>
              ) : (
                <div className="flex items-center gap-2 text-sm">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// The vulnerability cohort lens: for each statutory cohort, the share of pupils
// with an active concern who are in it, against that cohort's share of the roll.
// When the concern share runs ahead of the roll share, that cohort is carrying
// more than its proportion of concern — the head of safeguarding's first read.
export function CohortLens({
  rows,
}: {
  rows: { label: string; concernShare: number; rollShare: number; href?: string }[];
}) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const over = r.concernShare > r.rollShare + 0.02;
          const body = (
            <>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate group-hover:text-cobalt">{r.label}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {pct(r.concernShare)} of concerns · {pct(r.rollShare)} of roll
                </span>
              </div>
              <div className="relative mt-1 h-3 w-full rounded-full bg-paper">
                {/* Roll baseline (muted) behind the concern share (cobalt). */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/30"
                  style={{ width: `${r.rollShare * 100}%` }}
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${over ? "bg-warning" : "bg-cobalt"}`}
                  style={{ width: `${r.concernShare * 100}%`, opacity: 0.85 }}
                />
              </div>
            </>
          );
          return (
            <li key={r.label}>
              {r.href ? (
                <Link
                  href={r.href}
                  className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-cobalt" />
          Share of flagged pupils
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-muted-foreground/40" />
          Share of the roll
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-warning" />
          Over-represented
        </span>
      </div>
    </div>
  );
}
