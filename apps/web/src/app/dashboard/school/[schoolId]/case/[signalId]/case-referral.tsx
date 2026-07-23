"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Referral = {
  canRefer: boolean;
  submitted: boolean;
  stage: string | null;
  decision: string | null;
  events: { id: string; occurredOn: string; text: string }[];
};

const STAGE_LABEL: Record<string, string> = {
  submitted: "Submitted, awaiting MASH decision",
  chased: "Chased, awaiting MASH decision",
  decided: "Decision recorded",
  "re-referred": "Re-referred, awaiting MASH decision",
};

// Referral lifecycle (spec 5.10). Watch prepares and records; the school
// submits. Available only on cases serious enough to warrant it.
export function CaseReferral({
  signalId,
  schoolId,
  referral,
}: {
  signalId: string;
  schoolId: string;
  referral: Referral;
}) {
  const router = useRouter();
  const submit = api.casework.submitReferral.useMutation({
    onSuccess: () => router.refresh(),
  });
  const advance = api.casework.advanceReferral.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (!referral.submitted) {
    return (
      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          Prepare and record a referral to the multi-agency safeguarding hub.
          You submit to MASH; Watch tracks it.
        </p>
        <Button
          size="sm"
          disabled={submit.isPending}
          onClick={() => submit.mutate({ signalId, schoolId })}
        >
          <Send className="size-4" aria-hidden />
          {submit.isPending ? "Recording…" : "Record MASH referral"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm font-medium">
        {referral.stage ? STAGE_LABEL[referral.stage] ?? referral.stage : ""}
      </div>
      {referral.decision ? (
        <div className="mt-1 text-sm text-muted-foreground">
          {referral.decision}
        </div>
      ) : null}

      <ul className="mt-3 flex flex-col gap-1.5">
        {referral.events.map((e) => (
          <li key={e.id} className="text-xs text-muted-foreground">
            <span className="tabular-nums">{e.occurredOn}</span> · {e.text}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={advance.isPending}
          onClick={() =>
            advance.mutate({ signalId, schoolId, action: "chase" })
          }
        >
          Chase
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={advance.isPending}
          onClick={() =>
            advance.mutate({ signalId, schoolId, action: "re-refer" })
          }
        >
          Re-refer
        </Button>
      </div>

      <MashResponseReader signalId={signalId} schoolId={schoolId} />
    </div>
  );
}

// Read a MASH response, review Watch's proposal, then apply it (spec 5.11).
// Watch proposes; the DSL applies. Nothing changes state until the DSL confirms.
function MashResponseReader({
  signalId,
  schoolId,
}: {
  signalId: string;
  schoolId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [readText, setReadText] = useState<string | null>(null);

  const proposal = api.reader.readMashResponse.useQuery(
    { signalId, schoolId, text: readText ?? "" },
    { enabled: readText !== null && readText.length > 0 },
  );
  const apply = api.reader.applyMashResponse.useMutation({
    onSuccess: () => {
      setOpen(false);
      setText("");
      setReadText(null);
      router.refresh();
    },
  });

  if (!open) {
    return (
      <div className="mt-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          <BookOpen className="size-4" aria-hidden />
          Record MASH response
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-cloud p-3">
      <label className="text-xs font-medium text-muted-foreground">
        Paste the MASH response. Watch will read it and propose a decision.
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mt-1.5 min-h-24 w-full rounded-md border border-cloud bg-card p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={text.trim().length === 0}
          onClick={() => setReadText(text.trim())}
        >
          Read
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      {readText && proposal.data ? (
        <div className="mt-3 rounded-md bg-cobalt-tint p-3 text-sm">
          <div className="text-xs font-medium uppercase tracking-wide text-cobalt">
            Watch proposes
          </div>
          <div className="mt-1 font-medium">{proposal.data.decision}</div>
          <div className="mt-1 text-muted-foreground">
            {proposal.data.nextStep}
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              disabled={apply.isPending}
              onClick={() =>
                apply.mutate({
                  signalId,
                  schoolId,
                  decision: proposal.data!.decision,
                  nextStep: proposal.data!.nextStep,
                  rationale: proposal.data!.rationale,
                })
              }
            >
              {apply.isPending ? "Applying…" : "Apply to referral"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
