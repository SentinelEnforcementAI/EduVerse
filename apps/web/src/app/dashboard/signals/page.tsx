import Link from "next/link";
import { TRPCError } from "@trpc/server";

import { PupilAvatar } from "@/components/pupil-avatar";
import { SeverityBadge } from "@/components/severity-badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

export const metadata = { title: "Signals" };

const STATUSES = ["OPEN", "CONFIRMED", "DISMISSED", "ESCALATED"] as const;
type Status = (typeof STATUSES)[number];

const TAB_LABELS: Record<Status, string> = {
  OPEN: "Open",
  CONFIRMED: "Confirmed",
  DISMISSED: "Dismissed",
  ESCALATED: "Escalated",
};

export default async function SignalsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const requested = (await searchParams).status?.toUpperCase();
  const status: Status = STATUSES.includes(requested as Status)
    ? (requested as Status)
    : "OPEN";

  const api = await serverApi();
  let signals;
  try {
    signals = await api.signals.list({ status });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No school assigned</CardTitle>
            <CardDescription>
              Your account is not attached to a school yet, so there are no
              signals to show.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Signals</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Raised by the rules engine for your school, most severe first. The
          decision on every signal is yours — nothing is actioned
          automatically.
        </p>
      </div>

      <nav className="flex gap-1 border-b" aria-label="Signal status">
        {STATUSES.map((tab) => (
          <Link
            key={tab}
            href={`/dashboard/signals${tab === "OPEN" ? "" : `?status=${tab.toLowerCase()}`}`}
            className={
              tab === status
                ? "border-b-2 border-primary px-3 py-3 text-base font-medium text-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                : "px-3 py-3 text-base text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            }
          >
            {TAB_LABELS[tab]}
          </Link>
        ))}
      </nav>

      {signals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No {TAB_LABELS[status].toLowerCase()} signals</CardTitle>
            <CardDescription>
              {status === "OPEN"
                ? "When the rules engine raises a signal it will appear here with its full reasoning."
                : `Signals you ${TAB_LABELS[status].toLowerCase().replace("ed", "")} will appear here.`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        /* Signal rows (DESIGN.md v2): severity pill, pupil, one-line
           reasoning, age, chevron — whole row clickable. */
        <ul className="overflow-hidden rounded-lg border bg-card">
          {signals.map((signal) => (
            <li key={signal.id} className="border-b last:border-b-0">
              <Link
                href={`/dashboard/signals/${signal.id}`}
                className="flex items-center gap-4 px-4 py-3 transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <PupilAvatar
                  firstName={signal.pupil.firstName}
                  lastName={signal.pupil.lastName}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium">
                      {signal.pupil.firstName} {signal.pupil.lastName}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Year {signal.pupil.yearGroup} ·{" "}
                      {signal.pupil.registrationGroup}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {signal.title} · {signal.rule.name}
                  </div>
                </div>
                <span className="hidden text-sm tabular-nums text-muted-foreground sm:block">
                  {signal.updatedAt.toLocaleDateString("en-GB")}
                </span>
                <SeverityBadge severity={signal.severity} />
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
