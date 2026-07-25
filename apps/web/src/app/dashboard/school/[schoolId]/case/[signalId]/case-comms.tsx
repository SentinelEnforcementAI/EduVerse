"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Mail, MailOpen, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type CommOption = {
  type: string;
  label: string;
  blurb: string;
  primary: boolean;
};

const inputClass =
  "rounded-md border border-cloud bg-card px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatWhen(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Parse a comma/space/newline-separated recipient list into addresses.
function parseRecipients(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Take action (spec 5.6) + email mission control (slice 4): draft one of the
// comm types, edit it, then either file it, download it, or SEND it from the
// platform threaded to the case. Every sent message lands on the case
// communications timeline and the audit log — the machine drafts, the person
// sends. Nothing here dead-ends.
export function CommsPanel({
  signalId,
  schoolId,
  options,
}: {
  signalId: string;
  schoolId: string;
  options: CommOption[];
}) {
  const router = useRouter();
  const [type, setType] = useState<string | null>(null);
  // Local edits override the generated draft/defaults; null means "as generated".
  const [edited, setEdited] = useState<string | null>(null);
  const [subjectEdited, setSubjectEdited] = useState<string | null>(null);
  const [to, setTo] = useState("");

  const timeline = api.messages.list.useQuery({ signalId, schoolId });

  const draft = api.casework.draftComm.useQuery(
    { signalId, schoolId, type: (type ?? "parent") as never },
    { enabled: type !== null },
  );

  const selected = options.find((o) => o.type === type);
  const generated = draft.data?.type === type ? draft.data.body : "";
  const body = edited ?? generated;
  const subject = subjectEdited ?? (selected ? `${selected.label} — safeguarding` : "");

  function reset() {
    setType(null);
    setEdited(null);
    setSubjectEdited(null);
    setTo("");
  }

  const fileComm = api.casework.fileComm.useMutation({
    onSuccess: () => {
      reset();
      router.refresh();
    },
  });

  const send = api.messages.send.useMutation({
    onSuccess: async () => {
      reset();
      await timeline.refetch();
      router.refresh();
    },
  });

  const recipients = parseRecipients(to);
  const canSend =
    !send.isPending &&
    body.trim().length > 0 &&
    subject.trim().length > 0 &&
    recipients.length > 0;

  function download() {
    const label = selected?.label ?? "document";
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Watch_${label.replace(/[^a-z0-9]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const messages = timeline.data?.messages ?? [];

  return (
    <div>
      {/* Communications timeline — sent from and received into the platform. */}
      {messages.length > 0 ? (
        <ul className="mb-5 space-y-2">
          {messages.map((m) => {
            const inbound = m.direction === "INBOUND";
            return (
              <li
                key={m.id}
                className={`rounded-lg border px-3 py-2.5 text-sm ${
                  inbound
                    ? "border-cobalt/30 bg-cobalt-tint/40"
                    : "border-cloud bg-card"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {inbound ? (
                    <MailOpen className="size-4 text-cobalt" aria-hidden />
                  ) : (
                    <Mail className="size-4 text-muted-foreground" aria-hidden />
                  )}
                  <span className="font-medium">{m.subject}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      inbound
                        ? "bg-cobalt-tint text-cobalt"
                        : m.status === "SENT"
                          ? "bg-cobalt-tint text-cobalt"
                          : "bg-risk-tint text-risk"
                    }`}
                  >
                    {inbound ? "Received" : m.status === "SENT" ? "Sent" : "Failed"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {inbound
                    ? `From ${m.from} · ${formatWhen(m.createdAt)}`
                    : `To ${m.to.join(", ")} · ${m.sentBy ? `${m.sentBy} · ` : ""}${formatWhen(m.createdAt)}`}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.type}
            type="button"
            onClick={() => {
              setType(o.type);
              setEdited(null);
              setSubjectEdited(null);
            }}
            className={
              type === o.type
                ? "rounded-full border border-cobalt bg-cobalt-tint px-3 py-1.5 text-sm font-medium text-cobalt"
                : "rounded-full border border-cloud px-3 py-1.5 text-sm text-muted-foreground hover:border-ink hover:text-ink"
            }
            title={o.blurb}
          >
            {o.label}
          </button>
        ))}
      </div>

      {type !== null ? (
        <div className="mt-4">
          {draft.isPending ? (
            <p className="text-sm text-muted-foreground">Drafting…</p>
          ) : (
            <>
              <textarea
                className="h-80 w-full rounded-lg border border-cloud bg-card p-3 font-mono text-xs leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={body}
                onChange={(e) => setEdited(e.target.value)}
              />

              {/* Send from the platform, threaded to the case. */}
              <div className="mt-3 grid gap-2 rounded-lg border border-cloud bg-paper p-3 sm:grid-cols-[1fr_1fr]">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Recipients (comma-separated)
                  <input
                    type="text"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="mash@localauthority.gov.uk"
                    className={inputClass}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  Subject
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubjectEdited(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!canSend}
                  onClick={() =>
                    send.mutate({
                      signalId,
                      schoolId,
                      commType: type as never,
                      to: recipients,
                      subject,
                      body,
                    })
                  }
                >
                  <Send className="size-4" aria-hidden />
                  {send.isPending ? "Sending…" : "Send from platform"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={fileComm.isPending || body.trim().length === 0}
                  onClick={() =>
                    fileComm.mutate({
                      signalId,
                      schoolId,
                      type: type as never,
                      body,
                    })
                  }
                >
                  <FileText className="size-4" aria-hidden />
                  {fileComm.isPending ? "Filing…" : "File to case"}
                </Button>
                <Button variant="secondary" size="sm" onClick={download}>
                  <Download className="size-4" aria-hidden />
                  Download
                </Button>
                <Button variant="secondary" size="sm" onClick={reset}>
                  Cancel
                </Button>
                {send.error ? (
                  <span className="text-sm text-risk">{send.error.message}</span>
                ) : null}
                {fileComm.error ? (
                  <span className="text-sm text-risk">
                    {fileComm.error.message}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
