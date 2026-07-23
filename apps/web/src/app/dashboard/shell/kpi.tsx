import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { Sparkline } from "./sparkline";

// A KPI figure (spec 5.1 / 5.2). An icon tile anchors the card, the value leads,
// and an optional footer carries a status line and an honest trend sparkline
// (real series only, never invented). The icon tile uses cobalt (the workhorse
// for non-risk chrome); risk tone on the tile/sparkline is reserved for a
// genuinely risk-carrying figure. When an href is given the whole card is a
// link into the matching list.
export function KpiCard({
  label,
  value,
  href,
  icon: Icon,
  tone = "cobalt",
  footer,
  trend,
}: {
  label: string;
  value: number | string;
  href?: string;
  icon?: LucideIcon;
  tone?: "cobalt" | "risk" | "warning" | "success";
  footer?: React.ReactNode;
  trend?: number[];
}) {
  const tileClass =
    tone === "risk"
      ? "bg-risk-tint text-risk"
      : tone === "warning"
        ? "bg-warning-tint text-warning"
        : tone === "success"
          ? "bg-success-tint text-success"
          : "bg-cobalt-tint text-cobalt";

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
        {href ? (
          <ChevronRight
            className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-cobalt"
            aria-hidden
          />
        ) : null}
      </div>

      {footer || trend ? (
        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0 text-xs text-muted-foreground">{footer}</div>
          {trend ? <Sparkline data={trend} tone={tone} /> : null}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="h-full p-5 transition-colors group-hover:border-cobalt">
          {body}
        </Card>
      </Link>
    );
  }

  return <Card className="h-full p-5">{body}</Card>;
}

// A compact labelled figure used inside the trust school grid.
export function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
