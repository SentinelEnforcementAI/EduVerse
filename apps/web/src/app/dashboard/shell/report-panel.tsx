"use client";

import { useEffect, useState } from "react";
import { Download, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";

// A slide-in panel layered above the current view (spec section 4: the seven
// panels open, close, and layer). This is the panel host primitive the later
// action panels build on. It carries the termly report: real, pre-computed
// text passed from the server, downloadable, with no dead affordances.
export function ReportPanel({
  triggerLabel,
  title,
  filename,
  content,
}: {
  triggerLabel: string;
  title: string;
  filename: string;
  content: string;
}) {
  const [open, setOpen] = useState(false);

  // Close on Escape and lock body scroll while the panel is open.
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

  function download() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <FileText className="size-4" aria-hidden />
        {triggerLabel}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close panel"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="absolute right-0 top-0 flex h-full w-full max-w-[92vw] flex-col border-l border-cloud bg-card shadow-xl sm:w-[540px]"
          >
            <div className="flex items-center justify-between border-b border-cloud px-6 py-4">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
                {content}
              </pre>
            </div>
            <div className="border-t border-cloud px-6 py-4">
              <Button size="sm" onClick={download}>
                <Download className="size-4" aria-hidden />
                Download report
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
