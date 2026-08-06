import Link from "next/link";

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
        <Card className="h-full p-4 transition-colors group-hover:border-cobalt">
          {inner}
        </Card>
      </Link>
    );
  }
  return <Card className="p-4">{inner}</Card>;
}

// Concern volume over time — a trend is a line, not a column of bars. A cobalt
// line over a soft area fill, a node per month, the latest month picked out.
// Baseline sits at zero so the shape of the trend is honest, never exaggerated.
export function AreaTrend({ labels, values }: { labels: string[]; values: number[] }) {
  const w = 320;
  const h = 120;
  const pad = { top: 14, right: 8, bottom: 6, left: 8 };
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) =>
    pad.left + (n <= 1 ? 0 : (i / (n - 1)) * (w - pad.left - pad.right));
  const y = (v: number) => pad.top + (1 - v / max) * (h - pad.top - pad.bottom);
  const base = h - pad.bottom;
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${base} L${x(0).toFixed(1)},${base} Z`;
  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        role="img"
        aria-label="Concern volume by month"
      >
        <defs>
          <linearGradient id="area-cobalt" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--cobalt)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--cobalt)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#area-cobalt)" />
        <path
          d={line}
          fill="none"
          stroke="var(--cobalt)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {values.map((v, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(v)}
            r={i === n - 1 ? 3.5 : 2.5}
            fill={i === n - 1 ? "var(--cobalt)" : "var(--card)"}
            stroke="var(--cobalt)"
            strokeWidth="1.5"
          >
            <title>{`${labels[i]}: ${v}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {labels.map((l, i) => (
          <span key={i} className={i === n - 1 ? "font-medium text-ink" : ""}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

// A horizontal magnitude list — one hue, length encodes the count. A row with
// an `href` becomes a link to the concerns behind it.
export function BarList({
  rows,
  unit,
}: {
  rows: { label: string; value: number; note?: string; href?: string }[];
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate group-hover:text-cobalt">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {r.value}
                {unit ? ` ${unit}` : ""}
                {r.note ? ` · ${r.note}` : ""}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-paper">
              <div
                className="h-full rounded-full bg-cobalt"
                style={{ width: `${(r.value / max) * 100}%` }}
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
  1: { bg: "var(--muted-foreground)", label: "L1 Monitor" },
  2: { bg: "var(--cobalt)", label: "L2 Emerging" },
  3: { bg: "var(--warning-amber)", label: "L3 Targeted" },
  4: { bg: "var(--risk-red)", label: "L4 Statutory" },
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
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
      <div className="relative size-32 shrink-0">
        <svg viewBox="0 0 100 100" className="size-32 -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--cloud)"
            strokeWidth="12"
          />
          {segments.map((s) => (
            <circle
              key={s.level}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={LEVEL_STYLE[s.level]!.bg}
              strokeWidth="12"
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.offset}
            >
              <title>{`${LEVEL_STYLE[s.level]!.label}: ${s.count}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Concerns
          </span>
        </div>
      </div>
      <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-1">
        {mix.map((m) => {
          const row = (
            <>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: LEVEL_STYLE[m.level]!.bg }}
              />
              <span className="text-muted-foreground group-hover:text-cobalt">
                {LEVEL_STYLE[m.level]!.label}
              </span>
              <span className="ml-auto tabular-nums font-medium">{m.count}</span>
            </>
          );
          return (
            <li key={m.level}>
              {m.href ? (
                <Link
                  href={m.href}
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

// Decision outcomes — the caseload's health as a proportion bar with a legend.
const OUTCOME_STYLE: { key: string; label: string; bg: string }[] = [
  { key: "open", label: "Awaiting", bg: "var(--cobalt)" },
  { key: "confirmed", label: "Confirmed", bg: "var(--success-green)" },
  { key: "escalated", label: "Escalated", bg: "var(--warning-amber)" },
  { key: "dismissed", label: "Dismissed", bg: "var(--muted-foreground)" },
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
