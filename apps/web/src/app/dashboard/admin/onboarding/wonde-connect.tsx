"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cable, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const selectClass =
  "rounded-md border border-cloud bg-card px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type SchoolConnection = {
  tenantId: string;
  name: string;
  wondeSchoolId: string | null;
  wondeSchoolName: string | null;
  connectedAt: Date | string | null;
};

function formatDate(value: Date | string | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The live "Connect Wonde" panel. One access token serves the environment (the
// silo stack's secret); each school is mapped to the Wonde school that has
// approved the application. When no token is configured (the demo, or before
// self-connect), it explains that rather than offering an empty picker.
export function WondeConnect({
  configured,
  schools,
}: {
  configured: boolean;
  schools: SchoolConnection[];
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const available = api.wonde.availableSchools.useQuery(undefined, {
    enabled: configured,
  });

  const refresh = async () => {
    await utils.wonde.availableSchools.invalidate();
    router.refresh();
  };

  const link = api.wonde.link.useMutation({ onSuccess: refresh });
  const unlink = api.wonde.unlink.useMutation({ onSuccess: refresh });

  // Per-school pick, keyed by tenant so each row has its own selection.
  const [picks, setPicks] = useState<Record<string, string>>({});
  const options = available.data?.schools ?? [];

  if (!configured) {
    return (
      <div className="rounded-lg border border-dashed border-cloud px-4 py-3 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Wonde isn’t connected yet.</p>
        <p className="mt-1">
          Your Wonde access is set up for this environment during provisioning —
          once your trust approves Sentinel Watch in Wonde, your schools appear
          here to map. Attendance, behaviour and attainment then sync
          automatically; the platform only ever reads from your MIS.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-cloud overflow-hidden rounded-lg border border-cloud">
        {schools.map((s) => {
          const linked = s.wondeSchoolId !== null;
          return (
            <li
              key={s.tenantId}
              className="flex flex-wrap items-center gap-3 px-3 py-3 text-sm"
            >
              <span className="min-w-32 font-medium">{s.name}</span>
              {linked ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Check className="size-4 text-cobalt" aria-hidden />
                    {s.wondeSchoolName ?? s.wondeSchoolId}
                    {s.connectedAt ? (
                      <span className="text-xs">
                        · connected {formatDate(s.connectedAt)}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto"
                    disabled={unlink.isPending}
                    onClick={() => unlink.mutate({ tenantId: s.tenantId })}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <div className="ml-auto flex items-center gap-2">
                  {available.isLoading ? (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                      Loading schools…
                    </span>
                  ) : options.length === 0 ? (
                    <span className="text-muted-foreground">
                      No unlinked Wonde schools available
                    </span>
                  ) : (
                    <>
                      <select
                        aria-label={`Wonde school for ${s.name}`}
                        className={selectClass}
                        value={picks[s.tenantId] ?? ""}
                        onChange={(e) =>
                          setPicks((p) => ({
                            ...p,
                            [s.tenantId]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Choose a Wonde school…</option>
                        {options.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={link.isPending || !picks[s.tenantId]}
                        onClick={() =>
                          link.mutate({
                            tenantId: s.tenantId,
                            wondeSchoolId: picks[s.tenantId]!,
                          })
                        }
                      >
                        <Cable className="size-4" aria-hidden />
                        Connect
                      </Button>
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {link.error ? (
        <p className="mt-2 text-sm text-risk">{link.error.message}</p>
      ) : null}
      {unlink.error ? (
        <p className="mt-2 text-sm text-risk">{unlink.error.message}</p>
      ) : null}
      {available.error ? (
        <p className="mt-2 text-sm text-risk">
          Couldn’t load your Wonde schools: {available.error.message}
        </p>
      ) : null}
    </div>
  );
}
