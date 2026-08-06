import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Lock } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
import { LevelChip } from "../../../../shell/level-chip";
import { CaseMenu, RevealControl, NoteForm } from "./case-actions";
import { CommsPanel } from "./case-comms";
import { SnapshotPanel } from "./case-insight-panels";
import { DecisionPanel } from "./case-decision";
import { EvidenceTimeline, PupilContext } from "./case-evidence";
import {
  ContributingEvidence,
  LinkedDocumentsTable,
  StatusStrip,
  WatchAnalysis,
  type CaseStep,
} from "./case-panels";

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function waitingLabel(ms: number): string {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 60) return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

// Friendly labels for the append-only audit actions, so the trail reads as
// events a DSL recognises, not machine keys.
const AUDIT_LABELS: Record<string, string> = {
  "case.viewed": "Concern opened",
  "pupil.identity.revealed": "Identity revealed",
  "signal.dismissed": "Concern dismissed with reason",
  "case.note.added": "Case note added",
  "case.file.opened": "Case file opened",
  "referral.submitted": "Referral prepared",
  "review.scheduled": "Pastoral review scheduled",
};
function auditLabel(action: string): string {
  if (AUDIT_LABELS[action]) return AUDIT_LABELS[action]!;
  const t = action.replace(/[._]/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// The pupil concern workspace (spec 5.5): a focused safeguarding decision
// screen. The narrative runs case summary → Watch analysis → evidence → human
// decision → supporting record. Watch's reading is advisory throughout; every
// decision is the DSL's and is audited. Identity stays sealed until revealed.
export default async function CaseViewPage({
  params,
}: {
  params: Promise<{ schoolId: string; signalId: string }>;
}) {
  const { schoolId, signalId } = await params;
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  let c;
  try {
    c = await api.casework.case({ signalId, schoolId });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const colleagues = await api.casework.directory({ schoolId });
  const isDirector = tenancy.mode === "mat";

  // Status strip driven by real state — a stage is only marked when reached.
  const decided = c.status !== "OPEN";
  const actionRecorded =
    c.referral.submitted || c.caseFile.opened || decided;
  const steps: CaseStep[] = [
    { label: "Raised", state: "done" },
    { label: "Awaiting decision", state: decided ? "done" : "current" },
    { label: "Action recorded", state: actionRecorded ? "done" : "pending" },
    { label: "Reviewed", state: c.reviews.length > 0 ? "done" : "pending" },
    { label: "Closed", state: c.status === "DISMISSED" ? "done" : "pending" },
  ];

  const pattern =
    c.sources.length > 1
      ? "Cross-domain pattern"
      : `${c.interpretation.source} pattern`;

  return (
    <div>
      <Breadcrumbs
        items={
          isDirector
            ? [
                { label: "Trust overview", href: "/dashboard/trust" },
                { label: c.schoolName, href: `/dashboard/school/${schoolId}` },
                { label: c.ref },
              ]
            : [
                {
                  label: "Safeguarding overview",
                  href: `/dashboard/school/${schoolId}`,
                },
                {
                  label: "Concerns",
                  href: `/dashboard/school/${schoolId}/triage/active`,
                },
                { label: c.ref },
              ]
        }
      />

      {/* 1. Case header — a compact case summary */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {c.revealed && c.pupilName ? c.pupilName : c.ref}
          </h1>
          <p className="mt-1 text-lg font-medium">{c.headline}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <LevelChip level={c.escalation.level} />
            <span className="text-muted-foreground">
              {c.escalation.meaning === "Statutory threshold"
                ? "Statutory review required"
                : c.escalation.meaning}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Year {c.yearGroup} · {c.schoolName} · Surfaced{" "}
            {shortDate(c.surfacedAt)}
            {c.status === "OPEN" ? ` · Waiting ${waitingLabel(c.waitingMs)}` : ""}
          </p>
          {!c.revealed ? (
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              Identity sealed
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {c.revealed ? null : c.revealable ? (
            <RevealControl
              signalId={c.signalId}
              schoolId={c.schoolId}
              reasons={c.revealReasons}
            />
          ) : null}
          <CaseMenu />
        </div>
      </div>

      {/* Compact metadata row */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-ink tabular-nums">
            {c.signalsLinked}
          </span>{" "}
          linked signals
        </span>
        <span>
          <span className="font-semibold text-ink tabular-nums">
            {c.sources.length}
          </span>{" "}
          source {c.sources.length === 1 ? "system" : "systems"}
        </span>
        {c.timeToSurface ? (
          <span>
            <span className="font-semibold text-ink tabular-nums">
              {c.timeToSurface.days}
            </span>{" "}
            days to surface
          </span>
        ) : null}
      </div>

      {/* Compact status strip */}
      <div className="mt-4">
        <StatusStrip steps={steps} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main narrative column */}
        <div className="flex min-w-0 flex-col gap-6">
          {/* 2. Watch analysis hero */}
          <WatchAnalysis
            pattern={pattern}
            summary={c.overall}
            recommendedNextStep={c.escalation.route[0] ?? "DSL review"}
            signalsLinked={c.signalsLinked}
            systems={c.sources.length}
            timeToSurface={c.timeToSurface}
          />

          {/* 3. Evidence timeline */}
          <section id="evidence">
            <h2 className="text-lg font-[650]">Evidence Watch connected</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Every indicator traces back to its original school record.
            </p>
            <div className="mt-3">
              <EvidenceTimeline entries={c.timeline} />
            </div>
          </section>

          <ContributingEvidence factors={c.riskFactors} />

          {/* Prepare a document (advisory drafting) */}
          <section>
            <h2 className="text-lg font-[650]">Prepare a document</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Watch drafts a document for professional review; you edit, then
              file or download. Watch never sends anything itself.
            </p>
            <div className="mt-3">
              <CommsPanel
                signalId={c.signalId}
                schoolId={c.schoolId}
                options={c.commOptions}
              />
            </div>
          </section>

          {/* Linked documents — compact table */}
          <section>
            <h2 className="text-lg font-[650]">Linked documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Filed letters, records and referrals for this pupil, sealed by
              construction. Trust policies sit in the{" "}
              <Link
                href={`/dashboard/school/${schoolId}/documents`}
                className="text-cobalt hover:underline"
              >
                document repository
              </Link>
              .
            </p>
            {c.documents.length === 0 ? (
              <Card className="mt-3 p-4 text-sm text-muted-foreground">
                No documents filed for this pupil yet. Prepare one above; it files
                here, linked to the case.
              </Card>
            ) : (
              <div className="mt-3">
                <LinkedDocumentsTable
                  documents={c.documents}
                  schoolId={schoolId}
                />
              </div>
            )}
          </section>

          {/* Case notes — existing notes, then composer */}
          <section id="notes">
            <h2 className="text-lg font-[650]">Case notes</h2>
            {c.notes.length > 0 ? (
              <ul className="mt-3 flex flex-col gap-3">
                {c.notes.map((note) => (
                  <li key={note.id}>
                    <Card className="p-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-semibold text-ink-muted"
                        >
                          {note.author
                            .split(/\s+/)
                            .map((p) => p[0])
                            .filter(Boolean)
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()}
                        </span>
                        <span className="text-sm font-medium">
                          {note.author}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {note.createdAt.toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {note.tagged.length > 0 ? (
                          <span className="text-xs text-muted-foreground">
                            · notified {note.tagged.join(", ")}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">{note.body}</p>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <NoteForm
                signalId={c.signalId}
                schoolId={c.schoolId}
                colleagues={colleagues}
              />
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                Visible to authorised safeguarding staff
              </p>
            </div>
          </section>
        </div>

        {/* Right column — sticky decision workspace, then secondary/tertiary */}
        <div className="flex min-w-0 flex-col gap-4">
          <div id="decision" className="lg:sticky lg:top-6">
            <DecisionPanel
              signalId={c.signalId}
              schoolId={c.schoolId}
              level={c.escalation.level}
              waitingMs={c.waitingMs}
              status={c.status}
              canRefer={c.referral.canRefer}
              referral={c.referral}
              caseFile={c.caseFile}
              reviews={c.reviews}
              colleagues={colleagues}
            />
          </div>

          {c.revealed ? <SnapshotPanel snapshot={c.snapshot} /> : null}

          <PupilContext context={c.context} />

          {/* Linked concerns — compact */}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Linked concerns</h3>
              {c.linked.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No other open patterns
                </span>
              ) : null}
            </div>
            {c.linked.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1.5">
                {c.linked.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/dashboard/school/${schoolId}/case/${l.id}`}
                      className="group flex items-center justify-between gap-2 text-sm text-cobalt hover:underline"
                    >
                      {l.headline}
                      <ChevronRight className="size-4 shrink-0" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {/* Audit trail — humanised, with the acting professional */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Audit trail</h3>
            {c.audit.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No entries yet for this case.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {c.audit.map((e) => (
                  <li key={e.id} className="flex gap-2.5 text-sm">
                    <span
                      aria-hidden
                      className="mt-1 size-1.5 shrink-0 rounded-full bg-cobalt/60"
                    />
                    <div className="min-w-0">
                      <div className="text-xs tabular-nums text-muted-foreground">
                        {e.createdAt.toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div>
                        {auditLabel(e.action)}
                        <span className="text-muted-foreground"> · {e.by}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
