import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { AlertsQueue } from "./alerts-queue";

// Alerts: the action-threshold inbox as a prioritised decision queue. Every
// active concern at level 3 or 4 across the caller's scope, statutory pinned
// first, filterable and searchable, each opening its case. Sealed — a
// reference, a level and a one-line reason, never a name.
export default async function AlertsPage() {
  const api = await serverApi();
  const { alerts } = await api.overview.alerts();

  const rows = alerts.map((a) => ({
    id: a.id,
    schoolId: a.schoolId,
    schoolName: a.schoolName,
    ref: a.ref,
    yearGroup: a.yearGroup,
    headline: a.headline,
    level: a.level,
    domain: a.domain,
    signalCount: a.signalCount,
    waitingMs: a.waitingMs,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Concerns that have reached the action threshold. These need a DSL
        decision, not just monitoring.
      </p>

      {rows.length === 0 ? (
        <Card className="mt-6 p-6 text-base text-muted-foreground">
          Nothing at the action threshold right now. Watch is monitoring the
          wider caseload and will raise a concern here if a pattern strengthens.
        </Card>
      ) : (
        <AlertsQueue alerts={rows} />
      )}
    </div>
  );
}
