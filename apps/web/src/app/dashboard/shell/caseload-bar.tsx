import { LEVEL_META, type EscalationLevel } from "@/server/escalation";

// The escalation-level shape of a live caseload, as a single segmented bar.
// A risk-banded series, so it carries the risk palette (DESIGN.md): statutory
// red, targeted and emerging amber, monitor green. It shows how many concerns
// sit at each proportionate LEVEL, never a numeric score on a child.

export type LevelCounts = Record<EscalationLevel, number>;

// Highest level first, so the most urgent band leads the bar and the legend.
const ORDER: EscalationLevel[] = [4, 3, 2, 1];

const COLOR: Record<EscalationLevel, string> = {
  4: "var(--risk-red)",
  3: "var(--warning-amber)",
  2: "color-mix(in srgb, var(--warning-amber) 55%, white)",
  1: "var(--success-green)",
};

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
        className={`flex ${compact ? "h-2" : "h-2.5"} w-full overflow-hidden rounded-full bg-cloud`}
        role="img"
        aria-label={segments
          .map((l) => `${byLevel[l]} at ${LEVEL_META[l].meaning}`)
          .join(", ")}
      >
        {segments.map((l) => (
          <div
            key={l}
            style={{ flexGrow: byLevel[l], backgroundColor: COLOR[l] }}
            className="h-full min-w-[3px] first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>

      {!compact ? (
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          {ORDER.map((l) => (
            <li key={l} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="size-2.5 rounded-full"
                style={{ backgroundColor: COLOR[l] }}
              />
              <span className="text-muted-foreground">
                {LEVEL_META[l].meaning}
              </span>
              <span className="font-semibold tabular-nums">{byLevel[l]}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
