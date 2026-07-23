import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { buildSchoolTermlyReport } from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../shell/breadcrumbs";
import { KpiCard } from "../../shell/kpi";
import { ReportPanel } from "../../shell/report-panel";

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
          <p className="mt-1 text-base italic text-cobalt">{data.school.name}</p>
        </div>
        <ReportPanel
          triggerLabel="Termly report"
          title="Termly safeguarding report"
          filename="termly-safeguarding-report.txt"
          content={report}
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Pupils on roll" value={data.metrics.pupilsOnRoll} />
        <KpiCard label="Active concerns" value={data.metrics.activeConcerns} />
        <KpiCard
          label="Awaiting a decision"
          value={data.metrics.awaitingDecision}
        />
        <KpiCard label="Reviewed this term" value={data.metrics.reviewed} />
      </div>

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
            <Card key={pattern.id} className="p-5">
              <div className="text-lg font-semibold">
                {pattern.ref}{" "}
                <span className="font-normal text-muted-foreground">
                  · Year {pattern.yearGroup}
                </span>
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
          ))}
        </div>
      )}
    </div>
  );
}
