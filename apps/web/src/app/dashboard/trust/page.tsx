import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Flag,
  Network,
  Timer,
  Users,
} from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { buildTrustTermlyReport } from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { CaseloadBar } from "../shell/caseload-bar";
import { KpiCard, MiniStat } from "../shell/kpi";
import { ReportPanel } from "../shell/report-panel";
import { RiskPill } from "../shell/risk-pill";
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
        <KpiCard
          label="Schools in trust"
          value={data.metrics.schools}
          icon={Building2}
          footer={
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              All schools active
            </span>
          }
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
          footer={`${data.metrics.byLevel[3] + data.metrics.byLevel[4]} at action threshold`}
        />
        <KpiCard
          label="Awaiting a decision"
          value={data.metrics.awaitingDecision}
          href="/dashboard/trust/triage/awaiting"
          icon={Timer}
          footer="Needs a DSL decision"
        />
      </div>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              Caseload by escalation level
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.metrics.activeConcerns} active concerns across the trust
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
            Concerns crossing school boundaries this period. What looks local at
            one school reads as a cohort pattern across the trust.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cohort.patterns.map((p) => (
              <Link
                key={p.key}
                href={`/dashboard/trust/cohort/${p.key}`}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full p-5 transition-colors group-hover:border-cobalt">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                    <Network className="size-[18px]" aria-hidden />
                  </span>
                  <div className="mt-3 text-base font-semibold leading-snug">
                    {p.title}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {p.detail}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cobalt">
                    Investigate
                    <ChevronRight className="size-4" aria-hidden />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
