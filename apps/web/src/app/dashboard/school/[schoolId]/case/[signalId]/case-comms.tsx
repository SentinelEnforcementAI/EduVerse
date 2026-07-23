"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type CommOption = {
  type: string;
  label: string;
  blurb: string;
  primary: boolean;
};

// Take action (spec 5.6): draft one of the eight comm types, edit it, download
// it, and file it to the case. The draft is deterministic and complete; nothing
// here dead-ends.
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
  // Local edits override the generated draft; null means "show the draft as
  // generated". Deriving the editor value this way avoids syncing state in an
  // effect.
  const [edited, setEdited] = useState<string | null>(null);

  const draft = api.casework.draftComm.useQuery(
    { signalId, schoolId, type: (type ?? "parent") as never },
    { enabled: type !== null },
  );

  const generated = draft.data?.type === type ? draft.data.body : "";
  const body = edited ?? generated;

  const fileComm = api.casework.fileComm.useMutation({
    onSuccess: () => {
      setType(null);
      setEdited(null);
      router.refresh();
    },
  });

  function download() {
    const label = options.find((o) => o.type === type)?.label ?? "document";
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Watch_${label.replace(/[^a-z0-9]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.type}
            type="button"
            onClick={() => {
              setType(o.type);
              setEdited(null);
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setType(null)}
                >
                  Cancel
                </Button>
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
