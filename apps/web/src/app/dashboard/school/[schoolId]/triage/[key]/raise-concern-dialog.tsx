"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus, ShieldPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

// The four proportionate levels a DSL can assign by hand. These mirror the
// engine's escalation levels; the label set is inlined so this client component
// pulls in no server module.
const LEVELS: { value: 1 | 2 | 3 | 4; label: string; hint: string }[] = [
  { value: 1, label: "Monitor", hint: "Keep an eye on it, no action yet" },
  { value: 2, label: "Emerging need", hint: "School-led support" },
  { value: 3, label: "Targeted support", hint: "Early Help / coordinated support" },
  { value: 4, label: "Statutory threshold", hint: "Serious — may need MASH" },
];

// Raise a concern by hand — a human flagging what the engine never saw (a
// disclosure, a call from a parent). The pupil is identified by UPN so identity
// stays sealed; the new concern joins the same triage → decision → audit path.
export function RaiseConcernDialog({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [upn, setUpn] = useState("");
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(2);
  const [title, setTitle] = useState("");
  const [reason, setReason] = useState("");

  const raise = api.casework.raiseConcern.useMutation({
    onSuccess: (res) => {
      setOpen(false);
      router.push(`/dashboard/school/${res.schoolId}/case/${res.signalId}`);
      router.refresh();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function reset() {
    setUpn("");
    setLevel(2);
    setTitle("");
    setReason("");
    raise.reset();
  }

  const valid =
    upn.trim().length >= 1 && title.trim().length >= 3 && reason.trim().length >= 5;

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus className="size-4" aria-hidden />
        Raise a concern
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Raise a concern"
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-[14px] border border-[var(--card-border)] bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                  <ShieldPlus className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-[650] leading-tight">
                    Raise a concern
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    A human-raised concern, decided the same way as an engine one
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-paper hover:text-ink"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valid && !raise.isPending) {
                  raise.mutate({
                    schoolId,
                    upn: upn.trim(),
                    level,
                    title: title.trim(),
                    reason: reason.trim(),
                  });
                }
              }}
              className="space-y-4 px-5 py-4"
            >
              <div>
                <Label htmlFor="rc-upn">Pupil UPN</Label>
                <Input
                  id="rc-upn"
                  value={upn}
                  onChange={(e) => setUpn(e.target.value)}
                  placeholder="e.g. A203456789012"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The pupil&apos;s Unique Pupil Number from your MIS. Identity
                  stays sealed — Watch shows a reference, never a name.
                </p>
              </div>

              <div>
                <Label htmlFor="rc-title">What is the concern?</Label>
                <Input
                  id="rc-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short summary, e.g. Disclosure during form time"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-medium">
                  Proportionate level
                </legend>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {LEVELS.map((l) => (
                    <label
                      key={l.value}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${
                        level === l.value
                          ? "border-cobalt bg-cobalt-tint/50"
                          : "border-[var(--card-border)] hover:bg-paper"
                      }`}
                    >
                      <input
                        type="radio"
                        name="rc-level"
                        className="mt-0.5"
                        checked={level === l.value}
                        onChange={() => setLevel(l.value)}
                      />
                      <span>
                        <span className="font-medium">
                          L{l.value} · {l.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {l.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <Label htmlFor="rc-reason">Reason and detail</Label>
                <textarea
                  id="rc-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  placeholder="What was seen, heard or reported, and why it's a concern."
                  className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {raise.error ? (
                <p className="rounded-lg bg-risk-tint px-3 py-2 text-sm text-risk">
                  {raise.error.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-paper hover:text-ink"
                >
                  Cancel
                </button>
                <Button type="submit" size="sm" disabled={!valid || raise.isPending}>
                  {raise.isPending ? "Raising…" : "Raise concern"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
