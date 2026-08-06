"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Sheet, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export type ReportSchoolRow = {
  name: string;
  pupils: number;
  activeConcerns: number;
  awaitingDecision: number;
};

export type ReportData = {
  title: string;
  scopeName: string;
  period: string;
  generatedOn: string;
  metrics: { label: string; value: string }[];
  schools: ReportSchoolRow[];
  governanceNote: string;
  methodology: string;
  filenameBase: string;
  text: string;
};

const n = (v: number) => v.toLocaleString("en-GB");

// The termly report preview: a structured, board-ready layout in a wide drawer
// with a sticky header and footer. Every figure is the trust's live data. Export
// to CSV (the school table) or download the full text; nothing is fabricated.
export function ReportDrawer({ report }: { report: ReportData }) {
  const [open, setOpen] = useState(false);

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

  function save(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadText() {
    save(
      new Blob([report.text], { type: "text/plain;charset=utf-8" }),
      `${report.filenameBase}.txt`,
    );
  }

  function exportCsv() {
    const header = "School,Pupils,Active concerns,Awaiting decision";
    const lines = report.schools.map(
      (s) =>
        `"${s.name.replace(/"/g, '""')}",${s.pupils},${s.activeConcerns},${s.awaitingDecision}`,
    );
    save(
      new Blob([[header, ...lines].join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
      `${report.filenameBase}.csv`,
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <FileText className="size-4" aria-hidden />
        Preview report
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
            aria-label={report.title}
            className="absolute right-0 top-0 flex h-full w-full max-w-[94vw] flex-col bg-card shadow-xl sm:w-[700px]"
          >
            {/* Sticky branded header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--card-border)] bg-card px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-cobalt text-white">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-base font-[650] leading-tight">
                    {report.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {report.scopeName} · {report.period}
                  </p>
                </div>
              </div>
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
              {/* Reporting metadata */}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                <Meta label="Reporting period" value={report.period} />
                <Meta label="Generated" value={report.generatedOn} />
                <Meta label="Scope" value={report.scopeName} />
              </dl>

              {/* Executive summary metrics */}
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Executive summary
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {report.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-xl border border-[var(--card-border)] p-3"
                  >
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {m.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* School-level table */}
              {report.schools.length > 0 ? (
                <>
                  <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    School-level breakdown
                  </h3>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-[var(--card-border)]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--card-border)] text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">School</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Pupils
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Active concerns
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            Awaiting decision
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.schools.map((s) => (
                          <tr
                            key={s.name}
                            className="border-b border-[var(--card-border)] last:border-0"
                          >
                            <td className="px-3 py-2 font-medium">{s.name}</td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {n(s.pupils)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {n(s.activeConcerns)}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {n(s.awaitingDecision)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}

              {/* Governance statement as a shaded callout */}
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Governance statement
              </h3>
              <p className="mt-2 rounded-xl border border-cobalt/20 bg-cobalt-tint/40 p-4 text-sm leading-relaxed text-ink">
                {report.governanceNote}
              </p>

              {/* Methodology & audit note */}
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Methodology &amp; audit
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {report.methodology}
              </p>
            </div>

            {/* Sticky footer actions */}
            <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-[var(--card-border)] bg-card px-6 py-4">
              <Button size="sm" onClick={downloadText}>
                <Download className="size-4" aria-hidden />
                Download
              </Button>
              <Button size="sm" variant="secondary" onClick={exportCsv}>
                <Sheet className="size-4" aria-hidden />
                Export CSV
              </Button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-paper hover:text-ink"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value}</dd>
    </div>
  );
}
