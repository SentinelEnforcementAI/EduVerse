import type { RiskBand } from "@/server/api/routers/overview";
import { cn } from "@/lib/utils";

// A school's proportionate risk band as a labelled pill. Risk palette, always
// with the word (never colour alone), per DESIGN.md.
const STYLES: Record<RiskBand, string> = {
  LOW: "bg-success-tint text-ink",
  MEDIUM: "bg-warning-tint text-ink",
  HIGH: "bg-risk-tint text-ink",
};

export function RiskPill({
  band,
  className,
}: {
  band: RiskBand;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
        STYLES[band],
        className,
      )}
    >
      {band}
    </span>
  );
}
