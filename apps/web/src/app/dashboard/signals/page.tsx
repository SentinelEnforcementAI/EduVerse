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

export default async function SignalsPage() {
  const api = await serverApi();
  let signals;
  try {
    signals = await api.signals.list({ status: "OPEN" });
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
        <h1 className="text-2xl font-semibold tracking-tight">Open signals</h1>
        <p className="text-muted-foreground">
          Raised by the rules engine for your school, most severe first. The
          decision on every signal is yours — nothing is actioned
          automatically.
        </p>
      </div>

      {signals.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No open signals</CardTitle>
            <CardDescription>
              When the rules engine raises a signal it will appear here with
              its full reasoning.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {signals.map((signal) => (
            <li key={signal.id}>
              <Link
                href={`/dashboard/signals/${signal.id}`}
                className="block rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">
                      {signal.pupil.firstName} {signal.pupil.lastName}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Year {signal.pupil.yearGroup} ·{" "}
                      {signal.pupil.registrationGroup}
                    </span>
                  </div>
                  <SeverityBadge severity={signal.severity} />
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{signal.title}</span>
                  <span className="text-muted-foreground">
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
