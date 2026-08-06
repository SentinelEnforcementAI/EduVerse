import Link from "next/link";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// A KPI figure (spec 5.1 / 5.2). Every card shares one structure — icon tile,
// label, value, a short status line, and an action affordance — so the row
// reads as one designed system. Colour is earned, not decorative: an icon tile
// is monochrome by default; a risk-carrying figure takes the risk palette; and
// the single priority metric ("hero") takes a subtle cobalt wash with a CTA.
// Cobalt otherwise appears only on interaction (the chevron / CTA into a list).
export function KpiCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "neutral",
  footer,
  hero = false,
  cta,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon?: LucideIcon;
  tone?: "neutral" | "risk" | "warning" | "success";
  footer?: React.ReactNode;
  // The single most actionable card on the page — subtle cobalt background and
  // a call-to-action instead of a passive chevron.
  hero?: boolean;
  cta?: string;
}) {
  const tileClass = hero
    ? "bg-cobalt-tint text-cobalt"
    : tone === "risk"
      ? "bg-risk-tint text-risk"
      : tone === "warning"
        ? "bg-warning-tint text-warning"
        : tone === "success"
          ? "bg-success-tint text-success"
          : // Neutral: monochrome tile, no decorative cobalt.
            "bg-paper text-ink-muted";

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {Icon ? (
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              tileClass,
            )}
          >
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="mt-1 text-3xl font-semibold leading-none tabular-nums">
            {value}
          </div>
        </div>
        {href && !hero ? (
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-cobalt"
            aria-hidden
          />
        ) : null}
      </div>

      {hero && cta ? (
        <div className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cobalt">
          {cta}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      ) : footer ? (
        <div className="mt-4 text-xs text-muted-foreground">{footer}</div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card
          className={cn(
            "h-full p-5 card-interactive",
            hero ? "border-cobalt/25 bg-cobalt-tint/50" : "",
          )}
        >
          {body}
        </Card>
      </Link>
    );
  }

  return <Card className="h-full p-5">{body}</Card>;
}
