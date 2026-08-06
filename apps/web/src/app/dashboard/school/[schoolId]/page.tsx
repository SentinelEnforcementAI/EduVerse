import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardList, Flag, Timer, Users } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { buildSchoolTermlyReport } from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../shell/breadcrumbs";
import { CaseloadBar } from "../../shell/caseload-bar";
import { KpiCard } from "../../shell/kpi";
import { LevelChip } from "../../shell/level-chip";
import { ReportPanel } from "../../shell/report-panel";
import { Sparkline } from "../../shell/sparkline";

// School overview (spec 5.2): the DSL's home screen, and where a director lands
// when they drill into a school. KPI cards, then the current pattern list.
// Identity is sealed by default — pupils appear only as sealed references.
export default async function SchoolOverviewPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const api = await serverApi();

  const tenancy = await api.overview.tenancy();
  let data;
  try {
    data = await api.overview.school({ schoolId });
  } catch (error) {
    // No access to this school (or none such): back to the caller's own entry.
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const isDirector = tenancy.mode === "mat";
  const report = buildSchoolTermlyReport({
    schoolName: data.school.name,
    generatedOn: new Date(),
    pupilsOnRoll: data.metrics.pupilsOnRoll,
    activeConcerns: data.metrics.activeConcerns,
    awaitingDecision: data.metrics.awaitingDecision,
    reviewed: data.metrics.reviewed,
  });

  return (
    <div>
      {isDirector ? (
        <Breadcrumbs
          items={[
            { label: "Trust overview", href: "/dashboard/trust" },
            { label: data.school.name },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Safeguarding overview
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {data.school.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/school/${data.school.id}/kcsie`}
            className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            KCSIE
          </Link>
          <Link
            href={`/dashboard/school/${data.school.id}/documents`}
            className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Documents
          </Link>
          <Link
            href={`/dashboard/school/${data.school.id}/inspection`}
            className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
          >
            Inspection
          </Link>
          <ReportPanel
            triggerLabel="Termly report"
            title="Termly safeguarding report"
            filename="termly-safeguarding-report.txt"
            content={report}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Pupils on roll"
          value={data.metrics.pupilsOnRoll.toLocaleString("en-GB")}
          icon={Users}
          footer="On roll this term"
        />
        <KpiCard
          label="Active concerns"
          value={data.metrics.activeConcerns}
          href={`/dashboard/school/${data.school.id}/triage/active`}
          icon={Flag}
          tone="risk"
          footer={`${data.metrics.byLevel[3] + data.metrics.byLevel[4]} at action threshold`}
        />
        <KpiCard
          label="Awaiting a decision"
          value={data.metrics.awaitingDecision}
          href={`/dashboard/school/${data.school.id}/triage/awaiting`}
          icon={Timer}
          hero
          cta="Review queue"
        />
        <KpiCard
          label="Reviewed this term"
          value={data.metrics.reviewed}
          icon={ClipboardList}
          footer="Confirmed, escalated or closed"
        />
      </div>

      <Card className="mt-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Safeguarding caseload</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {data.metrics.activeConcerns} active concerns
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

      <h2 className="mt-10 text-xl font-semibold">Pattern intelligence</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Emerging patterns Watch has surfaced from this school&apos;s own data,
        highest priority first. Identity stays sealed until a case reaches the
        action threshold.
      </p>

      {data.patterns.length === 0 ? (
        <Card className="mt-4 p-6 text-base text-muted-foreground">
          No open patterns for this school yet. As the rules engine runs over
          ingested data, surfaced patterns appear here for review.
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {data.patterns.map((pattern) => (
            <Link
              key={pattern.id}
              href={`/dashboard/school/${data.school.id}/case/${pattern.id}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full p-5 card-interactive">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-lg font-semibold">
                    {pattern.ref}{" "}
                    <span className="font-normal text-muted-foreground">
                      · Year {pattern.yearGroup}
                    </span>
                  </div>
                  <LevelChip level={pattern.level} />
                </div>
                <div className="mt-2 text-base">{pattern.headline}</div>
                <div className="mt-3 text-xs text-muted-foreground">
                  Observed to{" "}
                  {pattern.windowEnd.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                  })}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
