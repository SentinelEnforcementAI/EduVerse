"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

// Read a training certificate, review Watch's proposal, then apply it to the
// vault (spec 5.11). Watch proposes; the DSL applies.
export function TrainingReader({ schoolId }: { schoolId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [readText, setReadText] = useState<string | null>(null);

  const proposal = api.reader.readTrainingCertificate.useQuery(
    { schoolId, text: readText ?? "" },
    { enabled: readText !== null && readText.length > 0 },
  );
  const apply = api.reader.applyTrainingRecord.useMutation({
    onSuccess: () => {
      setOpen(false);
      setText("");
      setReadText(null);
      router.refresh();
    },
  });

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <BookOpen className="size-4" aria-hidden />
        Read a training certificate
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-cloud p-4">
      <label className="text-xs font-medium text-muted-foreground">
        Paste a training certificate. Watch will read it and propose the
        renewal to record.
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
          <div className="mt-1 font-medium">{proposal.data.course}</div>
          <div className="mt-1 text-muted-foreground">
            {proposal.data.renews}
          </div>
          <div className="mt-3">
            <Button
              size="sm"
              disabled={apply.isPending}
              onClick={() =>
                apply.mutate({
                  schoolId,
                  course: proposal.data!.course,
                  renews: proposal.data!.renews,
                })
              }
            >
              {apply.isPending ? "Filing…" : "Apply and file"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
