import { LEVEL_COLOR, LEVEL_META, type EscalationLevel } from "@/server/escalation";

// The escalation-level shape of a live caseload, as a single segmented bar. It
// carries the canonical escalation palette: statutory red, targeted amber,
// emerging cobalt, monitor slate. It shows how many concerns sit at each
// proportionate LEVEL, never a numeric score on a child.

export type LevelCounts = Record<EscalationLevel, number>;

// Highest level first, so the most urgent band leads the bar and the legend.
const ORDER: EscalationLevel[] = [4, 3, 2, 1];

const COLOR = LEVEL_COLOR;

export function CaseloadBar({
  byLevel,
  className,
  compact = false,
}: {
  byLevel: LevelCounts;
  className?: string;
  compact?: boolean;
}) {
  const total = ORDER.reduce((n, l) => n + byLevel[l], 0);

  if (total === 0) {
    return (
      <div className={className}>
        <div className="h-2.5 w-full rounded-full bg-cloud" />
        {!compact ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No active concerns. Watch is monitoring.
          </p>
        ) : null}
      </div>
    );
  }

  const segments = ORDER.filter((l) => byLevel[l] > 0);

  return (
    <div className={className}>
      <div
        className={`flex ${compact ? "h-2" : "h-3"} w-full overflow-hidden rounded-full bg-cloud`}
        role="img"
        aria-label={segments
          .map((l) => `${byLevel[l]} at ${LEVEL_META[l].meaning}`)
          .join(", ")}
      >
        {segments.map((l) => (
          <div
            key={l}
            style={{ flexGrow: byLevel[l], backgroundColor: COLOR[l] }}
            // The statutory band (level 4) is often a sliver — give it a larger
            // minimum width and a soft inset ring so it never disappears.
            className={
              l === 4
                ? "h-full min-w-[10px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55)] first:rounded-l-full last:rounded-r-full"
                : "h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
            }
          />
        ))}
      </div>

      {!compact ? (
        // Figures read left-to-right in the same severity order as the bar, so
        // each count sits beneath its band. The statutory block is emphasised.
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ORDER.map((l) => (
            <div
              key={l}
              className={
                l === 4
                  ? "rounded-xl border border-risk/30 bg-risk-tint/40 px-3 py-2"
                  : "rounded-xl border border-[var(--card-border)] px-3 py-2"
              }
            >
              <div className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: COLOR[l] }}
                />
                <span
                  className={
                    l === 4
                      ? "text-xs font-semibold text-ink"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {LEVEL_META[l].meaning}
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span
                  className={
                    l === 4
                      ? "text-xl font-semibold tabular-nums text-risk"
                      : "text-xl font-semibold tabular-nums"
                  }
                >
                  {byLevel[l]}
                </span>
                {l === 4 ? (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-risk">
                    statutory
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
