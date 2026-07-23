"use client";

import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

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
    </div>
  );
}
