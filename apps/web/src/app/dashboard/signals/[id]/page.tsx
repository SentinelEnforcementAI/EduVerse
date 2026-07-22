import Link from "next/link";
import { notFound } from "next/navigation";
import { TRPCError } from "@trpc/server";

import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { DecisionPanel } from "./decision-panel";
import { GenerateNarrativeButton } from "./narrative-panel";

export const metadata = { title: "Signal detail" };

const DECISION_LABELS = {
  CONFIRM: "Confirmed",
  DISMISS: "Dismissed",
  ESCALATE: "Escalated",
} as const;

type Reasoning = {
  summary?: string;
  metrics?: Record<string, number | string>;
  dataPoints?: { label: string; date?: string; value: string | number }[];
};

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = await serverApi();

  let signal;
  try {
    signal = await api.signals.byId({ id });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      notFound();
    }
    throw error;
  }

  const reasoning = (signal.reasoning ?? {}) as Reasoning;

  return (
    <div className="flex flex-col gap-6">
      {/* Quiet pupil header (DESIGN.md): name and facts, no visual drama —
          the signal carries the urgency, not the child's identity. */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl font-bold tracking-tight">
              {signal.pupil.firstName} {signal.pupil.lastName}
            </h1>
            <SeverityBadge severity={signal.severity} />
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
              {signal.status.toLowerCase()}
            </span>
          </div>
          <p className="mt-1 text-sm tabular-nums text-muted-foreground">
            Year {signal.pupil.yearGroup} · {signal.pupil.registrationGroup} ·
            UPN {signal.pupil.upn}
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/signals">Back to signals</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{signal.title}</CardTitle>
          <CardDescription>
            {signal.ruleVersion.name} (rule {signal.ruleVersion.key} v
            {signal.ruleVersion.version}) · window{" "}
            {signal.windowStart.toLocaleDateString("en-GB")} –{" "}
            {signal.windowEnd.toLocaleDateString("en-GB")}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <h2 className="mb-1 text-sm font-bold">Why this fired</h2>
            <p className="text-sm text-muted-foreground">
              {reasoning.summary ?? "No summary recorded."}
            </p>
          </div>

          {reasoning.metrics ? (
            <div>
              <h2 className="mb-2 text-sm font-bold">The numbers behind it</h2>
              <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {Object.entries(reasoning.metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd className="tabular-nums">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {reasoning.dataPoints && reasoning.dataPoints.length > 0 ? (
            <div>
              <h2 className="mb-2 text-sm font-bold">Underlying records</h2>
              <ul className="flex flex-col gap-1 text-sm">
                {reasoning.dataPoints.map((point, index) => (
                  <li
                    key={index}
                    className="flex justify-between gap-4 border-b border-dashed py-1 last:border-0"
                  >
                    <span className="tabular-nums text-muted-foreground">
                      {point.date ? `${point.date} — ` : ""}
                      {point.label}
                    </span>
                    <span className="tabular-nums">{String(point.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Rule description: {signal.ruleVersion.description} · Raised by
            engine run {signal.execution.id} as of{" "}
            {signal.execution.asOf.toLocaleDateString("en-GB")}.
          </p>
        </CardContent>
      </Card>

      {signal.status === "OPEN" ? (
        <DecisionPanel signalId={signal.id} />
      ) : null}

      {signal.status === "CONFIRMED" ? (
        /* AI narrative treatment (DESIGN.md): visually distinct from system
           facts — slate left border, explicit label, muted framing. Amber is
           reserved for signals, so it never appears here. */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              AI summary
              <span className="rounded-full border border-slate/40 px-2.5 py-0.5 text-xs font-normal text-muted-foreground">
                AI-generated, advisory
              </span>
            </CardTitle>
            <CardDescription>
              Written by Claude (AWS Bedrock, London region) from
              pseudonymised data — no names or identifying details are sent.
              It informs your judgement; it never acts on the signal.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {signal.narrative ? (
              <div className="flex flex-col gap-2 border-l-2 border-slate pl-4">
                <p className="whitespace-pre-wrap text-sm">
                  {signal.narrative.content}
                </p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  AI-generated, advisory · generated{" "}
                  {signal.narrative.createdAt.toLocaleString("en-GB")} · model{" "}
                  {signal.narrative.modelId} · prompt{" "}
                  {signal.narrative.promptKey} v{signal.narrative.promptVersion}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No summary generated yet.
              </p>
            )}
            <GenerateNarrativeButton
              signalId={signal.id}
              hasNarrative={signal.narrative !== null}
            />
          </CardContent>
        </Card>
      ) : null}

      {signal.decisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Decision history</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              {signal.decisions.map((decision) => (
                <li key={decision.id} className="flex flex-col gap-0.5">
                  <span className="tabular-nums">
                    <span className="font-bold">
                      {DECISION_LABELS[decision.kind]}
                    </span>{" "}
                    by {decision.decidedBy} on{" "}
                    {decision.createdAt.toLocaleString("en-GB")}
                  </span>
                  {decision.note ? (
                    <span className="text-muted-foreground">
                      “{decision.note}”
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
