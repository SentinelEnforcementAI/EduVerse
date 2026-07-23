import Link from "next/link";
import { Moon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { LevelChip } from "../shell/level-chip";
import { SealedAvatar } from "../shell/sealed-avatar";

// On-call (spec 5.16): the out-of-hours view. The highest-priority active cases
// across the caller's scope, sealed, in a focused phone-width layout.
export default async function OnCallPage() {
  const api = await serverApi();
  const data = await api.casework.onCall();

  return (
    <div className="mx-auto max-w-md">
      <div className="flex items-center gap-2">
        <Moon className="size-5 text-cobalt" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">On-call</h1>
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        The cases that need attention out of hours, highest priority first.
        Identity stays sealed.
      </p>

      {data.rows.length === 0 ? (
        <Card className="mt-6 p-6 text-base text-muted-foreground">
          Nothing needs out-of-hours attention right now.
        </Card>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/school/${row.schoolId}/case/${row.id}`}
                className="block rounded-xl border border-cloud bg-card p-4 transition-colors hover:border-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start gap-3">
                  <SealedAvatar refLabel={row.ref} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{row.ref}</span>
                      <LevelChip level={row.level} />
                    </div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      Year {row.yearGroup} · {row.schoolName}
                    </div>
                    <div className="mt-1 text-sm">{row.headline}</div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
