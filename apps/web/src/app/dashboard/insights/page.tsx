import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Network } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import {
  AreaTrend,
  BarList,
  CohortLens,
  LevelDonut,
  Outcomes,
  StatTile,
} from "./insight-charts";

// Insights (head of safeguarding / director): the trust caseload as trends and
// cohorts — volume over time, the escalation-level mix, which domains drive
// concern, decision outcomes, the vulnerability cohort lens, and the cross-
// school patterns no single school can see. All real data; counts and rates,
// never a score on a child. Director-only.
export default async function InsightsPage() {
  const api = await serverApi();

  let insights;
  let cohort;
  try {
    [insights, cohort] = await Promise.all([
      api.insights.trust(),
      api.cohort.patterns(),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  const t = insights.totals;

  // Every figure drills through to the concerns behind it: the trust concerns
  // list already filters by school, domain, level, status and cohort, so we
  // just build the matching URL.
  const triage = (params: Record<string, string> = {}, key: "active" | "awaiting" = "active") => {
    const qs = new URLSearchParams(params).toString();
    return `/dashboard/trust/triage/${key}${qs ? `?${qs}` : ""}`;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
      <p className="mt-1 text-base text-muted-foreground">
        The trust safeguarding picture — trends, the escalation-level mix, and
        which cohorts are carrying concern. Real data across every school. Select
        any figure to open the concerns behind it.
      </p>

      {/* Headline figures */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Schools" value={t.schools} href="/dashboard/schools" />
        <StatTile
          label="Pupils on roll"
          value={t.pupilsOnRoll.toLocaleString("en-GB")}
          href="/dashboard/schools"
        />
        <StatTile label="Active concerns" value={t.activeConcerns} href={triage()} />
        <StatTile
          label="Awaiting decision"
          value={t.awaitingDecision}
          href={triage({}, "awaiting")}
        />
        <StatTile
          label="Escalated"
          value={t.escalated}
          href={triage({ status: "ESCALATED" })}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Concern volume over time */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Concern volume</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active concerns by the month they surfaced, across the trust.
          </p>
          <div className="mt-4">
            <AreaTrend
              labels={insights.volumeByMonth.labels}
              values={insights.volumeByMonth.values}
            />
          </div>
        </Card>

        {/* Escalation-level mix */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Escalation-level mix</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Where the live caseload sits. A level, never a score.
          </p>
          <div className="mt-4">
            <LevelDonut
              mix={insights.levelMix.map((m) => ({
                ...m,
                href: triage({ level: String(m.level) }),
              }))}
            />
          </div>
        </Card>

        {/* Domains driving concern */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">What&apos;s driving concern</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active concerns by domain.
          </p>
          <div className="mt-4">
            {insights.domainMix.length ? (
              <BarList
                rows={insights.domainMix.map((d) => ({
                  label: d.label,
                  value: d.count,
                  href: triage({ domain: d.key }),
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No active concerns.</p>
            )}
          </div>
        </Card>

        {/* Decision outcomes */}
        <Card className="p-5">
          <h2 className="text-base font-semibold">Decision outcomes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How the caseload has been worked. Watch never closes a case.
          </p>
          <div className="mt-4">
            <Outcomes
              outcomes={insights.outcomes}
              hrefs={{
                open: triage({}, "awaiting"),
                confirmed: triage({ status: "CONFIRMED" }),
                escalated: triage({ status: "ESCALATED" }),
              }}
            />
          </div>
        </Card>

        {/* Vulnerability cohort lens */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">Cohort lens</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            For each statutory cohort, the share of pupils with an active concern
            who are in it, against that cohort&apos;s share of the roll. When
            concern runs ahead of the roll, that cohort is carrying more than its
            proportion.
          </p>
          <div className="mt-4">
            <CohortLens
              rows={insights.cohortLens.map((c) => ({
                label: c.label,
                concernShare: c.concernShare,
                rollShare: c.rollShare,
                href: triage({ cohort: c.key }),
              }))}
            />
          </div>
        </Card>

        {/* Per-school comparison */}
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-base font-semibold">By school</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Active concerns per 100 pupils — a size-adjusted comparison, not a
            league table.
          </p>
          <div className="mt-4">
            <BarList
              rows={insights.bySchool.map((s) => ({
                label: s.name,
                value: s.per100,
                note: `${s.activeConcerns} of ${s.pupilsOnRoll}`,
                href: triage({ schoolId: s.id }),
              }))}
              unit="per 100"
            />
          </div>
        </Card>
      </div>

      {/* Cross-school patterns */}
      <div className="mt-10">
        <h2 className="text-xl font-semibold">Cross-school patterns</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What looks local at one school reads as a cohort pattern across the
          trust.
        </p>
        {cohort.patterns.length === 0 ? (
          <Card className="mt-4 p-6 text-sm text-muted-foreground">
            No cross-school patterns this period. Watch compares concerns across
            every school and surfaces the ones that cross a boundary here.
          </Card>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cohort.patterns.map((p) => (
              <Link
                key={p.key}
                href={`/dashboard/trust/cohort/${p.key}`}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full p-5 card-interactive">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                    <Network className="size-[18px]" aria-hidden />
                  </span>
                  <div className="mt-3 text-base font-semibold leading-snug">
                    {p.title}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">{p.detail}</div>
                  <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cobalt">
                    Investigate
                    <ChevronRight className="size-4" aria-hidden />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
