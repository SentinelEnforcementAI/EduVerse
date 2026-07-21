import { dbForTenant } from "@sentinel/db";

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{session?.user.name ? `, ${session.user.name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Signals for your school will appear here once the risk engine is
          live.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pupils on roll</CardTitle>
            <CardDescription>
              Synthetic data for development — no real pupil data until DPAs
              are signed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pupilCount === null ? (
              <span className="text-sm text-muted-foreground">
                No school assigned yet.
              </span>
            ) : (
              <span className="text-3xl font-semibold">{pupilCount}</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Signals</CardTitle>
            <CardDescription>
              Raised by the rules engine, each with its full reasoning. The
              detail view arrives with build step 6 — and nothing is actioned
              without a DSL&apos;s decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {openSignals === null ? (
              <span className="text-sm text-muted-foreground">
                No school assigned yet.
              </span>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-semibold">{openSignals}</span>
                <span className="text-sm text-muted-foreground">
                  open signal{openSignals === 1 ? "" : "s"} awaiting review
                </span>
              </div>
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
            <ul className="flex flex-col gap-2 text-sm">
              {latestSyncByType.map(({ type, run }) => (
                <li key={type} className="flex items-center justify-between">
                  <span>{SYNC_TYPE_LABELS[type]}</span>
                  {run ? (
                    <span
                      className={
                        run.status === "FAILED"
                          ? "text-destructive"
                          : run.status === "SUCCEEDED"
                            ? "text-green-700 dark:text-green-400"
                            : "text-muted-foreground"
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
