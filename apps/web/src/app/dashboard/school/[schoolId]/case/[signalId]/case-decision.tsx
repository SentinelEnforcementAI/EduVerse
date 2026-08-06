"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarClock, Clock, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/trpc/react";
import type { EscalationLevel } from "@/server/escalation";

import { DismissForm } from "./case-actions";
import { CaseFilePanel, ReviewScheduler } from "./case-file";
import { CaseReferral } from "./case-referral";
import { LevelChip } from "../../../../shell/level-chip";

function waitingLabel(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

type Option = { value: string; label: string; sub: string };

// Records a decision that has no dedicated mutation (monitoring / other) as an
// append-only case note, so the professional's choice and rationale enter the
// safeguarding record. Watch never records the decision itself.
function RationaleDecision({
  signalId,
  schoolId,
  prefix,
  cta,
}: {
  signalId: string;
  schoolId: string;
  prefix: string;
  cta: string;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const addNote = api.casework.addNote.useMutation({
    onSuccess: () => {
      setText("");
      router.refresh();
    },
  });
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">
        Reason for decision
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="This becomes part of the safeguarding record."
        className="mt-1 min-h-20 w-full rounded-lg border border-cloud bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        size="sm"
        className="mt-2"
        disabled={addNote.isPending || text.trim().length < 5}
        onClick={() =>
          addNote.mutate({
            signalId,
            schoolId,
            body: `${prefix}: ${text.trim()}`,
            taggedUserIds: [],
          })
        }
      >
        {addNote.isPending ? "Recording…" : cta}
      </Button>
      {addNote.error ? (
        <p className="mt-2 text-sm text-risk">{addNote.error.message}</p>
      ) : null}
    </div>
  );
}

// A quiet, collapsible secondary action beneath the primary decision.
function SecondaryAction({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof FolderOpen;
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-paper hover:text-ink"
      >
        <Icon className="size-4" aria-hidden />
        {label}
      </button>
      {open ? <div className="px-2 pb-2 pt-1">{children}</div> : null}
    </div>
  );
}

type ReferralData = React.ComponentProps<typeof CaseReferral>["referral"];
type CaseFileData = React.ComponentProps<typeof CaseFilePanel>["caseFile"];
type ReviewData = React.ComponentProps<typeof ReviewScheduler>["reviews"];

// The sticky decision workspace: escalation level, how long the concern has
// waited, the decision options, and the follow-up for the chosen option. The
// primary decision leads; secondary actions sit beneath at lower emphasis.
// Every option routes to an existing, audited flow — nothing new is actioned.
export function DecisionPanel({
  signalId,
  schoolId,
  level,
  waitingMs,
  status,
  canRefer,
  referral,
  caseFile,
  reviews,
  colleagues,
}: {
  signalId: string;
  schoolId: string;
  level: EscalationLevel;
  waitingMs: number;
  status: "OPEN" | "CONFIRMED" | "DISMISSED" | "ESCALATED";
  canRefer: boolean;
  referral: ReferralData;
  caseFile: CaseFileData;
  reviews: ReviewData;
  colleagues: { id: string; name: string }[];
}) {
  const [choice, setChoice] = useState<string>("");

  const options: Option[] = [
    ...(canRefer
      ? [
          {
            value: "mash",
            label: "Refer to MASH",
            sub: "Prepare a same-day referral to Children's Social Care",
          },
        ]
      : []),
    {
      value: "case",
      label: "Open safeguarding case",
      sub: "Start a case file and coordinated support",
    },
    {
      value: "monitor",
      label: "Continue monitoring",
      sub: "Record a decision to keep watching, no action yet",
    },
    {
      value: "dismiss",
      label: "Dismiss with recorded reason",
      sub: "Close the concern with an explanation",
    },
    { value: "other", label: "Other action", sub: "Record a different decision" },
  ];

  const decided = status !== "OPEN";

  return (
    <Card className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-cobalt">
        Decision required
      </div>
      <div className="mt-2 flex items-center gap-2">
        <LevelChip level={level} />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <Clock className="size-4" aria-hidden />
        Waiting {waitingLabel(waitingMs)}
      </div>

      {decided ? (
        <p className="mt-4 rounded-lg bg-paper p-3 text-sm text-muted-foreground">
          This concern has been {status.toLowerCase()} and recorded to the audit
          trail.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm font-medium">What action will you take?</p>
          <p className="text-xs text-muted-foreground">
            The decision is yours. Watch prepares and records; it never submits
            or closes anything itself.
          </p>
          <div className="mt-3 space-y-1.5">
            {options.map((o) => (
              <label
                key={o.value}
                className={`flex cursor-pointer gap-2.5 rounded-lg border p-2.5 text-sm transition-colors ${
                  choice === o.value
                    ? "border-cobalt bg-cobalt-tint/50"
                    : "border-[var(--card-border)] hover:border-cobalt/40"
                }`}
              >
                <input
                  type="radio"
                  name="decision"
                  value={o.value}
                  checked={choice === o.value}
                  onChange={() => setChoice(o.value)}
                  className="mt-0.5 accent-cobalt"
                />
                <span className="min-w-0">
                  <span className="font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {o.sub}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {/* Follow-up for the chosen option */}
          {choice ? (
            <div className="mt-4 border-t border-[var(--card-border)] pt-4">
              {choice === "mash" ? (
                <CaseReferral
                  signalId={signalId}
                  schoolId={schoolId}
                  referral={referral}
                />
              ) : null}
              {choice === "case" ? (
                <CaseFilePanel
                  signalId={signalId}
                  schoolId={schoolId}
                  caseFile={caseFile}
                />
              ) : null}
              {choice === "monitor" ? (
                <RationaleDecision
                  signalId={signalId}
                  schoolId={schoolId}
                  prefix="Decision — continue monitoring"
                  cta="Record monitoring decision"
                />
              ) : null}
              {choice === "dismiss" ? (
                <DismissForm signalId={signalId} schoolId={schoolId} />
              ) : null}
              {choice === "other" ? (
                <RationaleDecision
                  signalId={signalId}
                  schoolId={schoolId}
                  prefix="Decision"
                  cta="Record decision"
                />
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {/* Secondary actions — lower emphasis, beneath the primary decision */}
      <div className="mt-4 border-t border-[var(--card-border)] pt-2">
        <div className="px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Also available
        </div>
        <SecondaryAction icon={CalendarClock} label="Schedule pastoral review">
          <ReviewScheduler
            signalId={signalId}
            schoolId={schoolId}
            colleagues={colleagues}
            reviews={reviews}
          />
        </SecondaryAction>
        <SecondaryAction icon={FolderOpen} label="Open existing case file">
          <CaseFilePanel
            signalId={signalId}
            schoolId={schoolId}
            caseFile={caseFile}
          />
        </SecondaryAction>
      </div>
    </Card>
  );
}
