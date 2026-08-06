import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";

import { CaseloadBar, type LevelCounts } from "./caseload-bar";
import { RiskPill } from "./risk-pill";
import { Sparkline } from "./sparkline";
import type { RiskBand } from "@/server/api/routers/overview";

export type SchoolCardData = {
  id: string;
  name: string;
  dsl: string | null;
  pupilsOnRoll: number;
  activeConcerns: number;
  awaitingDecision: number;
  byLevel: LevelCounts;
  riskBand: RiskBand;
  trend: number[];
};

// One school as a card: a thin risk-coloured top edge for band-at-a-glance, the
// risk pill as the single top-right badge, the actionable "To decide" figure
// leading (not the roll), the live caseload shape, and a clear whole-card click
// affordance into the school. Used on both the trust overview and the schools
// list so the two read identically.
export function SchoolCard({ school }: { school: SchoolCardData }) {
  const edge =
    school.riskBand === "HIGH"
      ? "bg-risk"
      : school.riskBand === "MEDIUM"
        ? "bg-warning"
        : "bg-success";

  return (
    <Link
      href={`/dashboard/school/${school.id}`}
      className="group rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="relative h-full overflow-hidden p-5 card-interactive">
        <span aria-hidden className={`absolute inset-x-0 top-0 h-1 ${edge}`} />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-lg font-semibold">{school.name}</span>
            {school.dsl ? (
              <div className="mt-0.5 text-sm text-muted-foreground">
                DSL: {school.dsl}
              </div>
            ) : null}
          </div>
          <RiskPill band={school.riskBand} />
        </div>

        {/* "To decide" leads — it is the actionable number, not the roll. */}
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              To decide
            </div>
            <div className="mt-1 text-3xl font-semibold leading-none tabular-nums">
              {school.awaitingDecision}
            </div>
          </div>
          <div className="text-right text-xs leading-relaxed text-muted-foreground">
            <div>
              <span className="font-medium tabular-nums text-ink">
                {school.pupilsOnRoll.toLocaleString("en-GB")}
              </span>{" "}
              pupils
            </div>
            <div>
              <span className="font-medium tabular-nums text-ink">
                {school.activeConcerns}
              </span>{" "}
              active concerns
            </div>
          </div>
        </div>

        <CaseloadBar byLevel={school.byLevel} className="mt-4" compact />

        <div className="mt-4 flex items-center justify-between border-t border-[var(--card-border)] pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-cobalt">
            Open school
            <ChevronRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">12-mo</span>
            <Sparkline data={school.trend} width={72} height={24} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
