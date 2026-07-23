import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { CaseloadBar } from "../shell/caseload-bar";
import { MiniStat } from "../shell/kpi";
import { RiskPill } from "../shell/risk-pill";
import { Sparkline } from "../shell/sparkline";

// Schools (director): every school in the trust as a card with its risk band,
// live caseload shape and behaviour trend, each drilling into that school's
// overview. Director-only.
export default async function SchoolsPage() {
  const api = await serverApi();

  let data;
  try {
    data = await api.overview.trust();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
      <p className="mt-1 text-base text-muted-foreground">
        {data.trustName} · {data.metrics.schools} schools. Each school&apos;s
        risk band and caseload at a glance.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.schools.map((school) => (
          <Link
            key={school.id}
            href={`/dashboard/school/${school.id}`}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full p-5 transition-colors group-hover:border-cobalt">
              <div className="flex items-start justify-between gap-2">
                <span className="text-lg font-semibold">{school.name}</span>
                <div className="flex items-center gap-2">
                  <RiskPill band={school.riskBand} />
                  <ChevronRight
                    className="size-5 text-muted-foreground transition-colors group-hover:text-cobalt"
                    aria-hidden
                  />
                </div>
              </div>
              {school.dsl ? (
                <div className="mt-0.5 text-sm text-muted-foreground">
                  DSL: {school.dsl}
                </div>
              ) : null}

              <div className="mt-4 grid grid-cols-3 gap-3">
                <MiniStat label="Pupils" value={school.pupilsOnRoll} />
                <MiniStat label="Concerns" value={school.activeConcerns} />
                <MiniStat label="To decide" value={school.awaitingDecision} />
              </div>

              <CaseloadBar byLevel={school.byLevel} className="mt-4" compact />

              <div className="mt-4 flex items-center justify-between border-t border-cloud pt-3">
                <span className="text-xs text-muted-foreground">
                  Behaviour, 12-month trend
                </span>
                <Sparkline data={school.trend} />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
