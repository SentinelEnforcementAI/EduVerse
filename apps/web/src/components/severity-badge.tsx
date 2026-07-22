import { cn } from "@/lib/utils";

// Severity is amber weight, not new colours (DESIGN.md): the highest
// severity gets the heaviest amber treatment; lower severities step down to
// a soft amber tint and then a quiet neutral. Text always states the
// severity too — never colour alone — and amber is never used as text
// colour (it fails AA on cream); it is a background with ink text.
export function SeverityBadge({ severity }: { severity: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs",
        severity >= 3
          ? "bg-signal font-bold text-signal-foreground"
          : severity === 2
            ? "bg-signal-soft font-bold text-signal-foreground"
            : "bg-muted text-foreground",
      )}
    >
      severity {severity}
    </span>
  );
}
