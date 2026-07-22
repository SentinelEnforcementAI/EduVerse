import Link from "next/link";
import { TRPCError } from "@trpc/server";

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
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          Signals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
                ? "border-b-2 border-primary px-3 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                : "px-3 py-3 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        <ul className="flex flex-col gap-2">
          {signals.map((signal) => (
            <li key={signal.id}>
              <Link
                href={`/dashboard/signals/${signal.id}`}
                className="block rounded-lg border bg-card px-4 py-3 shadow-sm transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold">
                      {signal.pupil.firstName} {signal.pupil.lastName}
                    </span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Year {signal.pupil.yearGroup} ·{" "}
                      {signal.pupil.registrationGroup}
                    </span>
                  </div>
                  <SeverityBadge severity={signal.severity} />
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{signal.title}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {signal.rule.name} · updated{" "}
                    {signal.updatedAt.toLocaleDateString("en-GB")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
