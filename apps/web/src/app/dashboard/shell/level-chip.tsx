import { LEVEL_META, type EscalationLevel } from "@/server/escalation";
import { cn } from "@/lib/utils";

// Escalation-level chip (spec section 7). Carries the canonical escalation
// scale: L1 monitor (slate), L2 emerging (cobalt), L3 targeted (amber), L4
// statutory (red). The full level name always travels with the colour, so the
// chip never relies on colour alone. It shows the LEVEL, never a risk score.
const STYLES: Record<EscalationLevel, string> = {
  1: "bg-cloud text-ink",
  2: "bg-cobalt-tint text-ink",
  3: "bg-warning-tint text-ink",
  4: "bg-risk-tint text-ink",
};

export function LevelChip({
  level,
  className,
}: {
  level: EscalationLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLES[level],
        className,
      )}
    >
      {LEVEL_META[level].label}
    </span>
  );
}
