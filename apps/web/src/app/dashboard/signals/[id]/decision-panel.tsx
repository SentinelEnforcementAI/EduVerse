"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

export function DecisionPanel({ signalId }: { signalId: string }) {
  const [note, setNote] = useState("");
  const router = useRouter();
  const decide = api.signals.decide.useMutation({
    onSuccess: () => router.refresh(),
  });

  const submit = (kind: "CONFIRM" | "DISMISS" | "ESCALATE") => {
    decide.mutate({ signalId, kind, note: note.trim() || undefined });
  };

  // DESIGN.md v2: the decision actions stay visible while the DSL reads
  // the reasoning — the panel sticks to the bottom of the viewport.
  // Confirm is the cobalt primary; Escalate is secondary; Dismiss is an
  // ink outline — never red, red is for children at risk, not UI actions.
  return (
    <div className="sticky bottom-0 -mx-2 bg-background px-2 pb-2 pt-2">
      <Card>
        <CardHeader>
          <CardTitle>Your decision</CardTitle>
          <CardDescription>
            Confirm if this needs safeguarding attention, escalate if it needs
            action now, or dismiss with a reason. Every decision is recorded
            permanently — it cannot be edited or deleted later.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="decision-note">
              Note{" "}
              <span className="font-normal text-muted-foreground">
                (required when dismissing)
              </span>
            </Label>
            <textarea
              id="decision-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Context for this decision — what you know, what you'll do next."
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {decide.error ? (
            <p className="border-l-2 border-ink bg-muted px-3 py-2 text-base font-medium">
              {decide.error.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => submit("CONFIRM")}
              disabled={decide.isPending}
            >
              Confirm concern
            </Button>
            <Button
              onClick={() => submit("ESCALATE")}
              disabled={decide.isPending}
              variant="secondary"
            >
              Escalate
            </Button>
            <Button
              onClick={() => submit("DISMISS")}
              disabled={decide.isPending}
              variant="destructive"
            >
              Dismiss
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
