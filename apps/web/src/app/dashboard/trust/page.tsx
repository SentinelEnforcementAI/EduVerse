import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { buildTrustTermlyReport } from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { KpiCard, MiniStat } from "../shell/kpi";
import { ReportPanel } from "../shell/report-panel";

// Trust overview (spec 5.1): the trust safeguarding picture and where to look
// first. Trust KPI rollup, then a school-level grid that drills into each
// school's overview. Every figure is computed from real data.
export default async function TrustOverviewPage() {
  const api = await serverApi();

  let data;
  try {
    data = await api.overview.trust();
  } catch (error) {
    // A DSL (no trust) landing here is sent back to their own overview.
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  const report = buildTrustTermlyReport({
    trustName: data.trustName,
    generatedOn: new Date(),
    pupilsOnRoll: data.metrics.pupilsOnRoll,
    activeConcerns: data.metrics.activeConcerns,
    awaitingDecision: data.metrics.awaitingDecision,
    schools: data.schools,
  });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Trust safeguarding overview
          </h1>
          <p className="mt-1 text-base italic text-cobalt">
            {data.trustName} · {data.metrics.schools} schools
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/trust/kcsie"
            className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            KCSIE compliance
          </Link>
          <Link
            href="/dashboard/trust/inspection"
            className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Inspection
          </Link>
          <ReportPanel
            triggerLabel="Termly governance report"
            title="Termly governance report"
            filename="termly-governance-report.txt"
            content={report}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Schools in trust" value={data.metrics.schools} />
        <KpiCard label="Pupils on roll" value={data.metrics.pupilsOnRoll} />
        <KpiCard
          label="Active concerns"
          value={data.metrics.activeConcerns}
          href="/dashboard/trust/triage/active"
        />
        <KpiCard
          label="Awaiting a decision"
          value={data.metrics.awaitingDecision}
          href="/dashboard/trust/triage/awaiting"
        />
      </div>

      <h2 className="mt-10 text-xl font-semibold">School-level view</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.schools.map((school) => (
          <Link
            key={school.id}
            href={`/dashboard/school/${school.id}`}
            className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Card className="h-full p-5 transition-colors group-hover:border-cobalt">
              <div className="flex items-start justify-between gap-2">
                <span className="text-lg font-semibold">{school.name}</span>
                <ChevronRight
                  className="size-5 text-muted-foreground transition-colors group-hover:text-cobalt"
                  aria-hidden
                />
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
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
