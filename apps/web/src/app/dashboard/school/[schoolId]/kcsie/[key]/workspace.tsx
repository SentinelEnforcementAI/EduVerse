"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Task = { id: string; label: string; done: boolean };
type Doc = { id: string; title: string; type: string };

// KCSIE component workspace actions (spec 5.13): add and complete tasks, attach
// evidence from the vault. Every action is audited server-side.
export function Workspace({
  schoolId,
  componentKey,
  tasks,
  availableDocuments,
}: {
  schoolId: string;
  componentKey: string;
  tasks: Task[];
  availableDocuments: Doc[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [docId, setDocId] = useState(availableDocuments[0]?.id ?? "");

  const addTask = api.kcsie.addTask.useMutation({
    onSuccess: () => {
      setLabel("");
      router.refresh();
    },
  });
  const toggle = api.kcsie.toggleTask.useMutation({
    onSuccess: () => router.refresh(),
  });
  const attach = api.kcsie.attachEvidence.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <div>
      <ul className="flex flex-col gap-1">
        {tasks.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ schoolId, taskId: t.id })}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm hover:bg-paper"
            >
              {t.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className={t.done ? "text-muted-foreground line-through" : ""}>
                {t.label}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 rounded-md border border-cloud bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button
          size="sm"
          disabled={addTask.isPending || label.trim().length === 0}
          onClick={() => addTask.mutate({ schoolId, key: componentKey, label })}
        >
          Add
        </Button>
      </div>

      {availableDocuments.length > 0 ? (
        <div className="mt-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attach evidence
          </div>
          <div className="mt-2 flex gap-2">
            <select
              value={docId}
              onChange={(e) => setDocId(e.target.value)}
              className="flex-1 rounded-md border border-cloud bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {availableDocuments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={attach.isPending || !docId}
              onClick={() =>
                attach.mutate({ schoolId, key: componentKey, documentId: docId })
              }
            >
              Attach
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
