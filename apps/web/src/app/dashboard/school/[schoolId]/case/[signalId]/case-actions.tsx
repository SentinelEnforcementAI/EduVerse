"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Eye, Link as LinkIcon, Lock, MoreVertical, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

// The case overflow menu: real, useful actions only (print the case, copy a
// link to it). Never a set of dead affordances.
export function CaseMenu() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — leave the menu open so the user can retry.
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-9 items-center justify-center rounded-lg border border-cloud text-muted-foreground transition-colors hover:border-ink hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreVertical className="size-[18px]" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-cloud bg-card py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              window.print();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-paper"
          >
            <Printer className="size-4 text-muted-foreground" aria-hidden />
            Print case
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-paper"
          >
            {copied ? (
              <Check className="size-4 text-success" aria-hidden />
            ) : (
              <LinkIcon className="size-4 text-muted-foreground" aria-hidden />
            )}
            {copied ? "Link copied" : "Copy link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

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

  const NOTE_MAX = 1000;

  return (
    <div>
      <textarea
        className={textareaClass}
        placeholder="Add a note to this case…"
        value={body}
        maxLength={NOTE_MAX}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground">
        {body.length} / {NOTE_MAX}
      </div>
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
