import { cn } from "@/lib/utils";

export function SeverityBadge({ severity }: { severity: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        severity >= 3
          ? "bg-destructive/10 text-destructive"
          : severity === 2
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : "bg-muted text-muted-foreground",
      )}
    >
      severity {severity}
    </span>
  );
}
