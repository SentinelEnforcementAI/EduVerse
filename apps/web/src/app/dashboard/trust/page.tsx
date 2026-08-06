import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Flag, Timer, Users } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { buildTrustTermlyReport } from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { CaseloadBar } from "../shell/caseload-bar";
import { CrossSchoolPatterns } from "../shell/cross-school-patterns";
import { KpiCard } from "../shell/kpi";
import { ReportPanel } from "../shell/report-panel";
import { SchoolCard } from "../shell/school-card";
import { Sparkline } from "../shell/sparkline";

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

  const cohort = await api.cohort.patterns();

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
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
            <span className="font-medium text-ink">{data.trustName}</span>
            <span
              className="rounded-md border border-[var(--card-border)] bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {data.metrics.schools} schools
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              All connected
            </span>
          </div>
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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Schools in trust"
          value={data.metrics.schools}
          icon={Building2}
          footer="All schools active"
        />
        <KpiCard
          label="Pupils on roll"
          value={data.metrics.pupilsOnRoll.toLocaleString("en-GB")}
          icon={Users}
          footer={`Across ${data.metrics.schools} schools`}
        />
        <KpiCard
          label="Active concerns"
          value={data.metrics.activeConcerns}
          href="/dashboard/trust/triage/active"
          icon={Flag}
          tone="risk"
          footer={`${data.metrics.byLevel[3] + data.metrics.byLevel[4]} at action threshold`}
        />
        <KpiCard
          label="Awaiting a decision"
          value={data.metrics.awaitingDecision}
          href="/dashboard/trust/triage/awaiting"
          icon={Timer}
          hero
          cta="Review queue"
        />
      </div>

      <Card className="mt-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Safeguarding caseload</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.metrics.activeConcerns} active concerns across{" "}
              {data.metrics.schools} schools
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Behaviour, 12-month trend
            </span>
            <Sparkline data={data.metrics.trend} width={120} height={32} />
          </div>
        </div>
        <CaseloadBar byLevel={data.metrics.byLevel} className="mt-4" />
      </Card>

      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-xl font-semibold">School-level view</h2>
        <Link
          href="/dashboard/schools"
          className="inline-flex items-center gap-1 text-sm font-medium text-cobalt hover:underline"
        >
          View all schools <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.schools.map((school) => (
          <SchoolCard key={school.id} school={school} />
        ))}
      </div>

      {cohort.patterns.length > 0 ? (
        <>
          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Cross-school pattern intelligence
            </h2>
            <Link
              href="/dashboard/insights"
              className="inline-flex items-center gap-1 text-sm font-medium text-cobalt hover:underline"
            >
              View all insights <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <p className="mt-1 text-base text-muted-foreground">
            Signals that appear isolated within one school but become significant
            across the trust.
          </p>
          <CrossSchoolPatterns
            patterns={cohort.patterns}
            basePath="/dashboard/trust/cohort"
          />
        </>
      ) : null}
    </div>
  );
}
