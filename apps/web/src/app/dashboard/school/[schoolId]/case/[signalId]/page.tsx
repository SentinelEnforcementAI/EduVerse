import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Brain,
  CalendarClock,
  Clock,
  FolderOpen,
  Link2,
  ScrollText,
  Send,
} from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
import { LevelChip } from "../../../../shell/level-chip";
import {
  DismissForm,
  NoteForm,
  RevealControl,
  SealedNotice,
} from "./case-actions";
import { CommsPanel } from "./case-comms";
import { CaseFilePanel, ReviewScheduler } from "./case-file";
import { CaseReferral } from "./case-referral";

function formatDate(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDay(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

// Case view (spec 5.5), read-only. The explainability surfaces a DSL trusts:
// header, time to surface, the signal timeline with source attribution, the
// interpretation, the overall assessment, the escalation level with route and
// rationale, linked context, and the case audit trail. Identity stays sealed;
// the reveal, and the confirm / dismiss / note actions, arrive with the
// human-in-the-loop slice.
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
                { label: c.ref },
              ]
        }
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.revealed && c.pupilName ? c.pupilName : c.ref}
            </h1>
            <LevelChip level={c.escalation.level} />
          </div>
          <p className="mt-1 text-base text-muted-foreground">
            Year {c.yearGroup} · {c.schoolName} ·{" "}
            {c.revealed ? `Identity revealed (${c.ref})` : "Identity sealed"}
          </p>
          <p className="mt-3 text-lg font-medium">{c.headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.confidence} confidence · Observed {formatDate(c.window.start)} to{" "}
            {formatDate(c.window.end)}
          </p>
        </div>
        <div className="shrink-0">
          {c.revealed ? null : c.revealable ? (
            <RevealControl
              signalId={c.signalId}
              schoolId={c.schoolId}
              reasons={c.revealReasons}
            />
          ) : (
            <SealedNotice />
          )}
        </div>
      </div>

      {/* Time to surface */}
      {c.timeToSurface !== null ? (
        <Card className="mt-5 flex items-center gap-3 border-cobalt/30 bg-cobalt-tint p-4">
          <Clock className="size-5 shrink-0 text-cobalt" aria-hidden />
          <p className="text-sm">
            Watch linked{" "}
            <span className="font-semibold">{c.signalsLinked} signals</span>{" "}
            across {c.sources.length}{" "}
            {c.sources.length === 1 ? "system" : "systems"} into one pattern, and
            surfaced it{" "}
            <span className="font-semibold">{c.timeToSurface.days} days</span>{" "}
            before a {c.timeToSurface.cadenceLabel} would have connected them.
          </p>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-xl font-semibold">What Watch sees</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each indicator, with the source it came from. Every entry traces to
              an underlying record.
            </p>
            <ul className="mt-4 flex flex-col gap-3">
              {c.timeline.map((entry, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-20 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {formatDay(entry.date)}
                  </div>
                  <div className="min-w-0 flex-1 border-l border-cloud pb-1 pl-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-cobalt">
                      {entry.source}
                    </div>
                    <div className="mt-0.5 text-sm">{entry.label}</div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Risk interpretation</h2>
            <Card className="mt-3 p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-cobalt">
                {c.interpretation.source} · {c.interpretation.rule}
              </div>
              <p className="mt-2 text-sm leading-relaxed">
                {c.interpretation.summary}
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Object.entries(c.interpretation.metrics).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <Brain className="size-5 text-cobalt" aria-hidden />
              <h2 className="text-xl font-semibold">Watch&apos;s overall assessment</h2>
            </div>
            <Card className="mt-3 p-5">
              <p className="text-sm leading-relaxed">{c.overall}</p>
            </Card>
          </section>

          <section>
            <h2 className="text-xl font-semibold">Take action</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Draft a document for this case. Watch prepares it; you edit, then
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

          {c.documents.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">Case documents</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {c.documents.map((d) => (
                  <li key={d.id}>
                    <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div>
                        <div className="text-sm font-semibold">{d.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.type} ·{" "}
                          {d.docDate.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}{" "}
                          · {d.status}
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <h2 className="text-xl font-semibold">Case notes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Notes are part of the safeguarding record. Tag a colleague to
              notify them.
            </p>
            <div className="mt-3">
              <NoteForm
                signalId={c.signalId}
                schoolId={c.schoolId}
                colleagues={colleagues}
              />
            </div>
            {c.notes.length > 0 ? (
              <ul className="mt-4 flex flex-col gap-3">
                {c.notes.map((note) => (
                  <li key={note.id}>
                    <Card className="p-4">
                      <p className="text-sm leading-relaxed">{note.body}</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {note.author} ·{" "}
                        {note.createdAt.toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {note.tagged.length > 0
                          ? ` · tagged ${note.tagged.join(", ")}`
                          : ""}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </div>

        {/* Context column */}
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h3 className="text-base font-semibold">Decision</h3>
            {c.status === "OPEN" ? (
              <div className="mt-3">
                <p className="mb-3 text-sm text-muted-foreground">
                  The decision is yours. Watch never closes a case.
                </p>
                <DismissForm signalId={c.signalId} schoolId={c.schoolId} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                This case has been {c.status.toLowerCase()} and recorded to the
                audit trail.
              </p>
            )}
          </Card>

          {c.referral.canRefer ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-muted-foreground" aria-hidden />
                <h3 className="text-base font-semibold">Referral</h3>
              </div>
              <div className="mt-3">
                <CaseReferral
                  signalId={c.signalId}
                  schoolId={c.schoolId}
                  referral={c.referral}
                />
              </div>
            </Card>
          ) : null}

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <FolderOpen className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold">Case file</h3>
            </div>
            <div className="mt-3">
              <CaseFilePanel
                signalId={c.signalId}
                schoolId={c.schoolId}
                caseFile={c.caseFile}
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold">Pastoral review</h3>
            </div>
            <div className="mt-3">
              <ReviewScheduler
                signalId={c.signalId}
                schoolId={c.schoolId}
                colleagues={colleagues}
                reviews={c.reviews}
              />
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-base font-semibold">Escalation</h3>
            <div className="mt-3">
              <LevelChip level={c.escalation.level} />
            </div>
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommended route
            </p>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {c.escalation.route.map((step) => (
                <li key={step} className="text-sm">
                  {step}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Why this level
            </p>
            <p className="mt-1.5 text-sm leading-relaxed">
              {c.escalation.rationale}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold">Linked context</h3>
            </div>
            {c.linked.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No other open patterns for this pupil.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {c.linked.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/dashboard/school/${schoolId}/case/${l.id}`}
                      className="text-sm text-cobalt hover:underline"
                    >
                      {l.headline}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ScrollText className="size-4 text-muted-foreground" aria-hidden />
              <h3 className="text-base font-semibold">Case audit trail</h3>
            </div>
            {c.audit.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                No entries yet for this case.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {c.audit.map((e) => (
                  <li key={e.id} className="text-sm">
                    <span className="text-muted-foreground tabular-nums">
                      {e.createdAt.toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>{" "}
                    · {e.action}
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
