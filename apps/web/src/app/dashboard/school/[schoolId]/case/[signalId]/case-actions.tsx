"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Eye, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

const textareaClass =
  "w-full min-h-20 rounded-lg border border-cloud bg-card p-3 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Reveal identity (spec principle 2 / section 7). Only rendered when the case
// is revealable and not yet revealed. A reason is required and audited.
export function RevealControl({
  signalId,
  schoolId,
  reasons,
}: {
  signalId: string;
  schoolId: string;
  reasons: readonly string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(reasons[0] ?? "");
  const reveal = api.casework.reveal.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Eye className="size-4" aria-hidden />
        Reveal identity
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-cloud bg-card p-3">
      <label className="text-xs font-medium text-muted-foreground">
        Reason for revealing (recorded to the audit trail)
      </label>
      <select
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-cloud bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {reasons.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={reveal.isPending}
          onClick={() =>
            reveal.mutate({
              signalId,
              schoolId,
              reason: reason as never,
            })
          }
        >
          {reveal.isPending ? "Revealing…" : "Confirm reveal"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {reveal.error ? (
        <p className="mt-2 text-sm text-risk">{reveal.error.message}</p>
      ) : null}
    </div>
  );
}

// Shown when identity cannot yet be revealed (below the action threshold).
export function SealedNotice() {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <Lock className="size-4" aria-hidden />
      Identity sealed — reveals unlock at level 3
    </span>
  );
}

// Dismiss the signal with a reason (spec 5.4). Only for OPEN cases.
export function DismissForm({
  signalId,
  schoolId,
}: {
  signalId: string;
  schoolId: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const dismiss = api.casework.dismiss.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div>
      <textarea
        className={textareaClass}
        placeholder="Why is this being closed? This becomes part of the safeguarding record."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          variant="secondary"
          disabled={dismiss.isPending || reason.trim().length < 5}
          onClick={() => dismiss.mutate({ signalId, schoolId, reason })}
        >
          {dismiss.isPending ? "Closing…" : "Review and close"}
        </Button>
        {dismiss.error ? (
          <span className="text-sm text-risk">{dismiss.error.message}</span>
        ) : null}
      </div>
    </div>
  );
}

// Add a case note, optionally tagging colleagues (spec 5.5).
export function NoteForm({
  signalId,
  schoolId,
  colleagues,
}: {
  signalId: string;
  schoolId: string;
  colleagues: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [tagged, setTagged] = useState<string[]>([]);
  const addNote = api.casework.addNote.useMutation({
    onSuccess: () => {
      setBody("");
      setTagged([]);
      router.refresh();
    },
  });

  function toggle(id: string) {
    setTagged((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div>
      <textarea
        className={textareaClass}
        placeholder="Add a note to this case…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      {colleagues.length > 0 ? (
        <div className="mt-2">
          <span className="text-xs text-muted-foreground">Tag colleagues:</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {colleagues.map((c) => {
              const on = tagged.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={
                    on
                      ? "rounded-full border border-cobalt bg-cobalt-tint px-2.5 py-0.5 text-xs font-medium text-cobalt"
                      : "rounded-full border border-cloud px-2.5 py-0.5 text-xs text-muted-foreground hover:border-ink hover:text-ink"
                  }
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-3">
        <Button
          size="sm"
          disabled={addNote.isPending || body.trim().length === 0}
          onClick={() =>
            addNote.mutate({ signalId, schoolId, body, taggedUserIds: tagged })
          }
        >
          {addNote.isPending ? "Saving…" : "Add note"}
        </Button>
        {addNote.error ? (
          <span className="text-sm text-risk">{addNote.error.message}</span>
        ) : null}
      </div>
    </div>
  );
}
