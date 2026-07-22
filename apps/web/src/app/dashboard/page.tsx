import Link from "next/link";

import { dbForTenant } from "@sentinel/db";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthSession } from "@/server/auth/session";

import { SystemStatus } from "./system-status";

const SYNC_TYPE_LABELS = {
  STUDENTS: "Pupils",
  ATTENDANCE: "Attendance",
  BEHAVIOUR: "Behaviour",
  ATTAINMENT: "Attainment",
} as const;

export default async function DashboardPage() {
  const session = await getAuthSession();
  const tenantDb = session?.user.tenantId
    ? dbForTenant(session.user.tenantId)
    : null;
  const pupilCount = tenantDb ? await tenantDb.pupil.count() : null;
  const openSignals = tenantDb
    ? await tenantDb.signal.count({ where: { status: "OPEN" } })
    : null;
  const syncRuns = tenantDb
    ? await tenantDb.syncRun.findMany({
        orderBy: { queuedAt: "desc" },
        take: 50,
      })
    : [];
  const latestSyncByType = (
    Object.keys(SYNC_TYPE_LABELS) as (keyof typeof SYNC_TYPE_LABELS)[]
  ).map((type) => ({
    type,
    run: syncRuns.find((run) => run.type === type) ?? null,
  }));

  // KPI stat row (DESIGN.md v2): value, label. Deltas need history the
  // schema doesn't record yet — values only, no invented trends.
  const stats = [
    {
      label: "Pupils on roll",
      value: pupilCount,
      hint: "Synthetic data until DPAs are signed",
    },
    {
      label: "Open signals",
      value: openSignals,
      hint: "Awaiting a DSL decision",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{session?.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          Signals for your school will appear here once the risk engine is
          live.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">
              {stat.value ?? "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {stat.value === null ? "No school assigned yet" : stat.hint}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
            <CardDescription>
              Raised by the rules engine, each with its full reasoning —
              nothing is actioned without a DSL&apos;s decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {openSignals === null ? (
              <span className="text-base text-muted-foreground">
                No school assigned yet.
              </span>
            ) : (
              <Button asChild size="sm">
                <Link href="/dashboard/signals">Review signals</Link>
              </Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Data sync</CardTitle>
            <CardDescription>
              Ingestion from the school&apos;s MIS via Wonde (sandbox first).
              Read-only — Sentinel Watch never writes back.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-base">
              {latestSyncByType.map(({ type, run }) => (
                <li key={type} className="flex items-center justify-between">
                  <span>{SYNC_TYPE_LABELS[type]}</span>
                  {/* Ops status stays monochrome: red/amber/green carry risk
                      meaning about children exclusively (DESIGN.md v2). */}
                  {run ? (
                    <span
                      className={
                        run.status === "FAILED"
                          ? "font-medium tabular-nums"
                          : "tabular-nums text-muted-foreground"
                      }
                    >
                      {run.status.toLowerCase()}
                      {run.finishedAt
                        ? ` · ${run.finishedAt.toLocaleDateString("en-GB")}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">never synced</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <SystemStatus />
      </div>
    </div>
  );
}
