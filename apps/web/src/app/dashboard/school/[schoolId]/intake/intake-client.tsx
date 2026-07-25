"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Item = {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: Date | string;
};
type Case = { signalId: string; ref: string; title: string };

const selectClass =
  "rounded-md border border-cloud bg-card px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatWhen(value: Date | string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// One inbound item awaiting triage: read it, then assign it to a case or
// dismiss it. Assigning threads it onto the case as a received message.
export function IntakeRow({
  item,
  schoolId,
  cases,
}: {
  item: Item;
  schoolId: string;
  cases: Case[];
}) {
  const router = useRouter();
  const [signalId, setSignalId] = useState("");

  const assign = api.intake.assign.useMutation({
    onSuccess: () => router.refresh(),
  });
  const dismiss = api.intake.dismiss.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <li className="rounded-xl border border-cloud bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-medium">{item.subject}</span>
        <span className="text-xs text-muted-foreground">
          from {item.from} · {formatWhen(item.receivedAt)}
        </span>
      </div>
      <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
        {item.body}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          aria-label="Assign to case"
          className={selectClass}
          value={signalId}
          onChange={(e) => setSignalId(e.target.value)}
        >
          <option value="">Assign to a case…</option>
          {cases.map((c) => (
            <option key={c.signalId} value={c.signalId}>
              {c.ref} — {c.title}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!signalId || assign.isPending}
          onClick={() =>
            assign.mutate({ intakeItemId: item.id, signalId, schoolId })
          }
        >
          {assign.isPending ? "Assigning…" : "Assign"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate({ intakeItemId: item.id, schoolId })}
        >
          Dismiss
        </Button>
        {assign.error ? (
          <span className="text-sm text-risk">{assign.error.message}</span>
        ) : null}
      </div>
    </li>
  );
}
