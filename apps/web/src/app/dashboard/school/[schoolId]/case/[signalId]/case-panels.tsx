import Link from "next/link";
import {
  Activity,
  CalendarX,
  ChevronRight,
  Download,
  FileText,
  GraduationCap,
  HeartPulse,
  MoreHorizontal,
  Network,
  ShieldAlert,
} from "lucide-react";

import { Card } from "@/components/ui/card";

// A source string like "Pastoral / Watch entry" carries a domain and a source
// system. Split them so the evidence can show a domain icon and a system badge.
export function parseSource(src: string): { domain: string; system: string } {
  const [domain, ...rest] = src.split("/").map((s) => s.trim());
  return { domain: domain || src, system: rest.join(" / ") || "Watch" };
}

// A stable, module-scope icon component (literal branches, no component
// selected into a render-time variable) so the domain icon can be chosen from a
// source string without tripping the static-components lint.
export function DomainIcon({
  domain,
  className,
}: {
  domain: string;
  className?: string;
}) {
  const d = domain.toLowerCase();
  if (d.includes("attend"))
    return <CalendarX className={className} aria-hidden />;
  if (d.includes("behav")) return <Activity className={className} aria-hidden />;
  if (d.includes("attain") || d.includes("send") || d.includes("academic"))
    return <GraduationCap className={className} aria-hidden />;
  if (d.includes("pastoral") || d.includes("wellbeing"))
    return <HeartPulse className={className} aria-hidden />;
  return <ShieldAlert className={className} aria-hidden />;
}

// ── Watch Analysis hero ────────────────────────────────────────────────────
// The visual centre of the page: Watch's advisory reading of the connected
// signals, the recommended next step for professional review, and why it
// surfaced. Advisory only — Watch recommends; the DSL decides.
export function WatchAnalysis({
  pattern,
  summary,
  recommendedNextStep,
  signalsLinked,
  systems,
  timeToSurface,
}: {
  pattern: string;
  summary: string;
  recommendedNextStep: string;
  signalsLinked: number;
  systems: number;
  timeToSurface: { days: number; cadenceLabel: string } | null;
}) {
  return (
    <Card className="border-cobalt/20 bg-cobalt-tint/50 p-6">
      <div className="flex items-center gap-2">
        <Network className="size-4 text-cobalt" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-cobalt">
          Watch analysis
        </span>
        <span className="ml-auto rounded-full bg-card/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Advisory · for professional review
        </span>
      </div>

      <h2 className="mt-3 text-lg font-[650]">{pattern}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink">{summary}</p>

      <div className="mt-4 rounded-xl border border-cobalt/20 bg-card/70 p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Recommended next step
        </div>
        <p className="mt-0.5 text-sm font-medium text-ink">
          {recommendedNextStep}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          A recommendation for the DSL to weigh — Watch does not make
          safeguarding decisions.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-ink">Why this surfaced</span>
        <span>
          {signalsLinked} signals · {systems}{" "}
          {systems === 1 ? "system" : "systems"}
        </span>
        {timeToSurface ? (
          <span>
            Connected {timeToSurface.days}{" "}
            {timeToSurface.days === 1 ? "day" : "days"} before the next{" "}
            {timeToSurface.cadenceLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href="#evidence"
          className="inline-flex items-center gap-1.5 rounded-lg border border-cobalt/30 bg-card px-3 py-2 text-sm font-medium text-cobalt hover:bg-cobalt-tint"
        >
          Review evidence
        </a>
        <a
          href="#decision"
          className="inline-flex items-center gap-1.5 rounded-lg bg-cobalt px-3 py-2 text-sm font-medium text-white hover:bg-cobalt-deep"
        >
          Record decision
        </a>
      </div>
    </Card>
  );
}

// ── Status strip ───────────────────────────────────────────────────────────
// A compact five-stage strip driven by real state. Never marks a stage the case
// has not actually reached (e.g. "Action recorded" only once a decision exists).
export type CaseStep = { label: string; state: "done" | "current" | "pending" };

export function StatusStrip({ steps }: { steps: CaseStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-sm">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1">
          <span
            className={
              s.state === "done"
                ? "inline-flex items-center gap-1.5 rounded-full bg-cobalt-tint px-2.5 py-1 text-xs font-medium text-cobalt"
                : s.state === "current"
                  ? "inline-flex items-center gap-1.5 rounded-full border border-cobalt bg-card px-2.5 py-1 text-xs font-semibold text-cobalt"
                  : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-muted-foreground"
            }
          >
            {s.state === "done" ? <span aria-hidden>✓</span> : null}
            {s.label}
          </span>
          {i < steps.length - 1 ? (
            <ChevronRight
              className="size-3.5 shrink-0 text-muted-foreground/60"
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

// ── Contributing evidence by domain ────────────────────────────────────────
// The domains behind the concern, each with the indicators that justify it.
// The escalation level belongs to the concern as a whole, so it is NOT repeated
// beside every domain here.
export function ContributingEvidence({
  factors,
}: {
  factors: { domain: string; evidence: string[] }[];
}) {
  if (factors.length === 0) return null;
  return (
    <section>
      <h2 className="text-lg font-[650]">Contributing evidence by domain</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The domains behind this concern, each with the indicators that justify
        it.
      </p>
      <Card className="mt-3 divide-y divide-[var(--card-border)] p-0">
        {factors.map((f) => {
          return (
            <div key={f.domain} className="p-4">
              <div className="flex items-center gap-2">
                <DomainIcon
                  domain={f.domain}
                  className="size-4 text-muted-foreground"
                />
                <span className="text-sm font-semibold">{f.domain}</span>
                <span className="text-xs text-muted-foreground">
                  {f.evidence.length} linked{" "}
                  {f.evidence.length === 1 ? "indicator" : "indicators"}
                </span>
              </div>
              <ul className="mt-2 space-y-1">
                {f.evidence.map((e, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50"
                    />
                    <span className="min-w-0">{e}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Card>
      <a
        href="#evidence"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-cobalt hover:underline"
      >
        View source records
        <ChevronRight className="size-4" aria-hidden />
      </a>
    </section>
  );
}

// ── Linked documents table ─────────────────────────────────────────────────
// A compact table rather than a stack of cards. "This case" tags only appear
// when documents from another of the pupil's concerns are also shown.
export function LinkedDocumentsTable({
  documents,
  schoolId,
}: {
  documents: {
    id: string;
    title: string;
    type: string;
    status: string;
    docDate: Date;
    linkedTo: string;
  }[];
  schoolId: string;
}) {
  const mixed = documents.some((d) => d.linkedTo !== "case");
  return (
    <div className="overflow-x-auto rounded-[14px] border border-[var(--card-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--card-border)] text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Document</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr
              key={d.id}
              className="border-b border-[var(--card-border)] last:border-0"
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="font-medium">{d.title}</span>
                  {mixed && d.linkedTo !== "case" ? (
                    <span className="rounded-full bg-paper px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Pupil record
                    </span>
                  ) : null}
                </div>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{d.type}</td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {d.docDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{d.status}</td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/dashboard/school/${schoolId}/documents/${d.id}`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-cobalt hover:bg-cobalt-tint"
                  >
                    View
                  </Link>
                  <Link
                    href={`/dashboard/school/${schoolId}/documents/${d.id}`}
                    aria-label="Download"
                    className="rounded-md p-1 text-muted-foreground hover:bg-paper hover:text-ink"
                  >
                    <Download className="size-4" aria-hidden />
                  </Link>
                  <Link
                    href={`/dashboard/school/${schoolId}/documents/${d.id}`}
                    aria-label="More"
                    className="rounded-md p-1 text-muted-foreground hover:bg-paper hover:text-ink"
                  >
                    <MoreHorizontal className="size-4" aria-hidden />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
