import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";

// A KPI figure (spec 5.1 / 5.2). Monochrome by brand rule: these are counts,
// not risk on a child, so no red/amber/green — colour is reserved for
// risk meaning elsewhere (DESIGN.md v2). Values are computed, never invented.
// When an href is given the whole card opens the matching triage list.
export function KpiCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
      {href ? (
        <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-cobalt opacity-0 transition-opacity group-hover:opacity-100">
          View list <ArrowRight className="size-3.5" aria-hidden />
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="h-full p-5 transition-colors group-hover:border-cobalt">
          {body}
        </Card>
      </Link>
    );
  }

  return <Card className="p-5">{body}</Card>;
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
