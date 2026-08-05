import { Card } from "@/components/ui/card";

// Static, server-rendered charts for the trust insights page. In the spirit of
// the app's "honest sparkline": every series is real data, every value is
// directly labelled or legended (identity is never colour-alone), magnitude
// uses a single hue (cobalt), and the escalation scale uses the level palette.

export function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
    </Card>
  );
}

// Concern volume by month — magnitude over time. Column heights encode a real
// count; the current month is labelled.
export function MonthlyVolume({ labels, values }: { labels: string[]; values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {values.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="text-[10px] tabular-nums text-muted-foreground">
              {v > 0 ? v : ""}
            </div>
            <div
              className="w-full rounded-t bg-cobalt/80"
              style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
              title={`${labels[i]}: ${v}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {labels.map((l, i) => (
          <div key={i} className="flex-1 text-center text-[10px] text-muted-foreground">
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

// A horizontal magnitude list — one hue, length encodes the count.
export function BarList({
  rows,
  unit,
}: {
  rows: { label: string; value: number; note?: string }[];
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
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
        </li>
      ))}
    </ul>
  );
}

const LEVEL_STYLE: Record<number, { bg: string; label: string }> = {
  1: { bg: "var(--muted-foreground)", label: "L1 Monitor" },
  2: { bg: "var(--cobalt)", label: "L2 Emerging" },
  3: { bg: "var(--warning-amber)", label: "L3 Targeted" },
  4: { bg: "var(--risk-red)", label: "L4 Statutory" },
};

// The escalation-level mix of the active caseload: a single proportion bar on
// the ordinal level palette, with a labelled legend (never colour-alone).
export function LevelMix({ mix }: { mix: { level: number; count: number }[] }) {
  const total = mix.reduce((n, m) => n + m.count, 0) || 1;
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-paper">
        {mix.map((m) =>
          m.count > 0 ? (
            <div
              key={m.level}
              style={{
                width: `${(m.count / total) * 100}%`,
                backgroundColor: LEVEL_STYLE[m.level]!.bg,
              }}
              title={`${LEVEL_STYLE[m.level]!.label}: ${m.count}`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {mix.map((m) => (
          <li key={m.level} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: LEVEL_STYLE[m.level]!.bg }}
            />
            <span className="text-muted-foreground">{LEVEL_STYLE[m.level]!.label}</span>
            <span className="tabular-nums font-medium">{m.count}</span>
          </li>
        ))}
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
}: {
  outcomes: { open: number; confirmed: number; escalated: number; dismissed: number };
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
        {OUTCOME_STYLE.map((o) => (
          <li key={o.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: o.bg }}
            />
            <span className="text-muted-foreground">{o.label}</span>
            <span className="tabular-nums font-medium">
              {outcomes[o.key as keyof typeof outcomes]}
            </span>
          </li>
        ))}
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
  rows: { label: string; concernShare: number; rollShare: number }[];
}) {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div>
      <ul className="space-y-3">
        {rows.map((r) => {
          const over = r.concernShare > r.rollShare + 0.02;
          return (
            <li key={r.label}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate">{r.label}</span>
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
