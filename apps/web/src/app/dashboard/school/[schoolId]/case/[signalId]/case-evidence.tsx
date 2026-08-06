"use client";

import { useState } from "react";
import { ChevronDown, User } from "lucide-react";

import { Card } from "@/components/ui/card";

import { DomainIcon, parseSource } from "./case-panels";

type Entry = {
  date: string | null;
  label: string;
  source: string;
  recordedBy: string | null;
};

function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// The evidence Watch connected — a chronology behind the analysis. Each row
// carries a domain icon, its source system, and (where the record attributes
// it) the recording professional. Rows expand for detail. The final entry (the
// disclosure) is emphasised without turning every row blue. A vertical line
// joins the events.
export function EvidenceTimeline({ entries }: { entries: Entry[] }) {
  return (
    <Card className="p-5">
      <ol className="relative">
        {entries.map((e, i) => (
          <EvidenceRow
            key={i}
            entry={e}
            last={i === entries.length - 1}
            first={i === 0}
          />
        ))}
      </ol>
    </Card>
  );
}

function EvidenceRow({
  entry,
  last,
  first,
}: {
  entry: Entry;
  last: boolean;
  first: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { domain, system } = parseSource(entry.source);
  // The final entry is the disclosure — give it a quiet red accent, not a blue
  // one, so it reads as the most serious point in the chronology.
  const disclosure = last;

  return (
    <li className="flex gap-3">
      <div className="w-14 shrink-0 pt-3 text-xs tabular-nums text-muted-foreground">
        {formatDay(entry.date)}
      </div>
      {/* Vertical rail with a node per event */}
      <div className="flex flex-col items-center">
        {!first ? <span className="h-3 w-px bg-cloud" aria-hidden /> : <span className="h-3" />}
        <span
          className={`size-2.5 shrink-0 rounded-full border-2 ${disclosure ? "border-risk bg-risk" : "border-cobalt bg-card"}`}
          aria-hidden
        />
        {!last ? <span className="w-px flex-1 bg-cloud" aria-hidden /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-3 pt-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={`w-full rounded-lg p-2 text-left transition-colors hover:bg-paper ${disclosure ? "bg-risk-tint/40" : ""}`}
        >
          <div className="flex items-center gap-2">
            <DomainIcon
              domain={domain}
              className={`size-4 shrink-0 ${disclosure ? "text-risk" : "text-muted-foreground"}`}
            />
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {domain}
            </span>
            <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {system}
            </span>
            {disclosure ? (
              <span className="rounded-full bg-risk-tint px-1.5 py-0.5 text-[10px] font-semibold text-risk">
                Disclosure
              </span>
            ) : null}
            <ChevronDown
              className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </div>
          <div className="mt-1 text-sm text-ink">{entry.label}</div>
          {entry.recordedBy ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="size-3.5" aria-hidden />
              Recorded by {entry.recordedBy}
            </div>
          ) : null}
        </button>
        {open ? (
          <div className="mt-1 rounded-lg border border-[var(--card-border)] bg-card p-3 text-xs text-muted-foreground">
            <p>
              Held in <span className="font-medium text-ink">{system}</span>
              {entry.recordedBy ? (
                <>
                  , recorded by{" "}
                  <span className="font-medium text-ink">
                    {entry.recordedBy}
                  </span>
                </>
              ) : null}
              . Watch links to this record; it never edits the source system.
            </p>
          </div>
        ) : null}
      </div>
    </li>
  );
}

type Context = {
  pupilPremium: boolean;
  freeSchoolMeals: boolean;
  senStatus: string | null;
  eal: boolean;
  lookedAfter: boolean;
  youngCarer: boolean;
  serviceChild: boolean;
  medicalNeeds: string | null;
};

// Relevant pupil context — statutory/contextual factors, collapsed by default.
// These are contextual, not risk conclusions, so they use neutral grey chips;
// amber and red are reserved for concern severity elsewhere.
export function PupilContext({ context }: { context: Context }) {
  const [open, setOpen] = useState(false);
  const labels: string[] = [];
  if (context.lookedAfter) labels.push("Looked-after child");
  if (context.youngCarer) labels.push("Young carer");
  if (context.serviceChild) labels.push("Service child");
  if (context.pupilPremium) labels.push("Pupil Premium");
  if (context.freeSchoolMeals) labels.push("Free school meals");
  if (context.senStatus) labels.push(context.senStatus);
  if (context.eal) labels.push("EAL");
  if (context.medicalNeeds) labels.push(context.medicalNeeds);

  if (labels.length === 0) return null;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="text-sm font-semibold">Relevant pupil context</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {labels.length} {labels.length === 1 ? "factor" : "factors"}
          <ChevronDown
            className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {labels.map((l) => (
            <span
              key={l}
              className="rounded-full border border-[var(--card-border)] bg-paper px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {l}
            </span>
          ))}
        </div>
      ) : null}
    </Card>
  );
}
