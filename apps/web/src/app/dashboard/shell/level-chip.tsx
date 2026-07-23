import { LEVEL_META, type EscalationLevel } from "@/server/escalation";
import { cn } from "@/lib/utils";

// Escalation-level chip (spec section 7). The risk palette is reserved for risk
// meaning about a child, and a proportionate escalation level is exactly that,
// so it may use it: level 4 red, 3 and 2 amber, 1 green. It shows the LEVEL,
// never a numeric risk score.
const STYLES: Record<EscalationLevel, string> = {
  1: "bg-success-tint text-ink",
  2: "bg-warning-tint text-ink",
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
