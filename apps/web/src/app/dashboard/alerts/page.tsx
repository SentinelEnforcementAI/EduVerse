import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { LevelChip } from "../shell/level-chip";
import { SealedAvatar } from "../shell/sealed-avatar";

// Alerts: the action-threshold inbox. Every active concern at level 3 or 4
// across the caller's scope, most urgent first, each opening its case. Sealed —
// a reference, a level and a one-line reason, never a name.
export default async function AlertsPage() {
  const api = await serverApi();
  const { alerts } = await api.overview.alerts();

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Concerns that have reached the action threshold. These need a DSL
        decision, not just monitoring.
      </p>

      {alerts.length === 0 ? (
        <Card className="mt-6 p-6 text-base text-muted-foreground">
          Nothing at the action threshold right now. Watch is monitoring the
          wider caseload and will raise a concern here if a pattern strengthens.
        </Card>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-xl border border-cloud bg-card">
          {alerts.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/school/${a.schoolId}/case/${a.id}`}
                className="flex items-center gap-4 border-b border-cloud px-5 py-4 transition-colors last:border-b-0 hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <SealedAvatar refLabel={a.ref} />
                <LevelChip
                  level={a.level}
                  className="hidden w-44 justify-center sm:inline-flex"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {a.ref}{" "}
                    <span className="font-normal text-muted-foreground">
                      · Year {a.yearGroup} · {a.schoolName}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {a.headline}
                  </div>
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
