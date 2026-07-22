import { cn } from "@/lib/utils";

// DESIGN.md v2 risk indication: severity bands, not numeric scores — the
// engine's 1–3 severity maps to Monitor / Medium / High. Status colours
// appear as pill tints with a bold dot and ink text (red and amber as small
// text fail AA); every band carries its label, never colour alone.
const BANDS = {
  high: {
    label: "High risk",
    pill: "bg-risk-tint",
    dot: "bg-risk",
  },
  medium: {
    label: "Medium",
    pill: "bg-warning-tint",
    dot: "bg-warning",
  },
  monitor: {
    label: "Monitor",
    pill: "bg-success-tint",
    dot: "bg-success",
  },
} as const;

export function severityBand(severity: number): keyof typeof BANDS {
  if (severity >= 3) return "high";
  if (severity === 2) return "medium";
  return "monitor";
}

export function SeverityBadge({ severity }: { severity: number }) {
  const band = BANDS[severityBand(severity)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-ink",
        band.pill,
      )}
    >
      <span className={cn("size-1.5 rounded-full", band.dot)} aria-hidden />
      {band.label}
    </span>
  );
}
