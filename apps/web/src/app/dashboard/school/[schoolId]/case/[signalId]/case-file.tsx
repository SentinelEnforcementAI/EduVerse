"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Task = { id: string; label: string; done: boolean };

// Case file (spec 5.7): open it to seed a checklist from the recommended route,
// then work through the tasks. Progress is persisted and audited.
export function CaseFilePanel({
  signalId,
  schoolId,
  caseFile,
}: {
  signalId: string;
  schoolId: string;
  caseFile: { opened: boolean; tasks: Task[]; done: number; total: number };
}) {
  const router = useRouter();
  const open = api.casework.openCaseFile.useMutation({
    onSuccess: () => router.refresh(),
  });
  const toggle = api.casework.toggleCaseTask.useMutation({
    onSuccess: () => router.refresh(),
  });

  if (!caseFile.opened) {
    return (
      <div>
        <p className="mb-3 text-sm text-muted-foreground">
          Opening a case file creates a managed record with the recommended
          actions to work through. Everything is audited.
        </p>
        <Button
          size="sm"
          disabled={open.isPending}
          onClick={() => open.mutate({ signalId, schoolId })}
        >
          <FolderOpen className="size-4" aria-hidden />
          {open.isPending ? "Opening…" : "Open case file"}
        </Button>
      </div>
    );
  }

  const pct = caseFile.total
    ? Math.round((caseFile.done / caseFile.total) * 100)
    : 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {caseFile.done} of {caseFile.total} complete
        </span>
        <span className="font-semibold tabular-nums">{pct}%</span>
      </div>
      <ul className="flex flex-col gap-1">
        {caseFile.tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ taskId: task.id, schoolId })}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-paper"
            >
              {task.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className={task.done ? "text-muted-foreground line-through" : ""}>
                {task.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Review = {
  id: string;
  scheduledFor: string;
  note: string | null;
  attendees: string[];
  by: string;
};

// Pastoral review scheduling (spec 5.8): pick a date/time, optionally invite
// colleagues, and add a note. Appended to the record and audited.
export function ReviewScheduler({
  signalId,
  schoolId,
  colleagues,
  reviews,
}: {
  signalId: string;
  schoolId: string;
  colleagues: { id: string; name: string }[];
  reviews: Review[];
}) {
  const router = useRouter();
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [attendees, setAttendees] = useState<string[]>([]);
  const schedule = api.casework.scheduleReview.useMutation({
    onSuccess: () => {
      setWhen("");
      setNote("");
      setAttendees([]);
      router.refresh();
    },
  });

  function toggle(id: string) {
    setAttendees((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div>
      {reviews.length > 0 ? (
        <ul className="mb-4 flex flex-col gap-2">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-md border border-cloud p-3 text-sm">
              <div className="font-medium">{r.scheduledFor}</div>
              {r.attendees.length > 0 ? (
                <div className="text-xs text-muted-foreground">
                  With {r.attendees.join(", ")}
                </div>
              ) : null}
              {r.note ? <div className="mt-1 text-xs">{r.note}</div> : null}
            </li>
          ))}
        </ul>
      ) : null}

      <label className="text-xs font-medium text-muted-foreground">
        Date and time
      </label>
      <input
        type="datetime-local"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        className="mt-1 w-full rounded-md border border-cloud bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {colleagues.length > 0 ? (
        <div className="mt-3">
          <span className="text-xs text-muted-foreground">Invite:</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {colleagues.map((c) => {
              const on = attendees.includes(c.id);
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
      <textarea
        className="mt-3 min-h-16 w-full rounded-lg border border-cloud bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="Agenda note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-2">
        <Button
          size="sm"
          disabled={schedule.isPending || when.trim().length === 0}
          onClick={() =>
            schedule.mutate({
              signalId,
              schoolId,
              scheduledFor: when,
              attendees,
              note: note.trim() || undefined,
            })
          }
        >
          {schedule.isPending ? "Scheduling…" : "Schedule review"}
        </Button>
      </div>
    </div>
  );
}
