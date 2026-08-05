import { Check, HeartPulse, ShieldAlert } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { EscalationLevel } from "@/server/escalation";

import { LevelChip } from "../../../../shell/level-chip";

// Presentational server components for the enriched case workspace: the
// safeguarding-context flag strip, the domain risk-factor breakdown, the case
// lifecycle stepper, and the revealed personal snapshot. All take plain data —
// no function props cross into a client component here.

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

// Statutory vulnerability markers, shown even while the case is sealed — they
// are non-identifying context (KCSIE cohorts), not the child's identity.
export function ContextFlags({ context }: { context: Context }) {
  const flags: { label: string; tone: "amber" | "cobalt" | "slate" }[] = [];
  if (context.lookedAfter) flags.push({ label: "Looked-after child", tone: "amber" });
  if (context.youngCarer) flags.push({ label: "Young carer", tone: "amber" });
  if (context.serviceChild) flags.push({ label: "Service child", tone: "slate" });
  if (context.pupilPremium) flags.push({ label: "Pupil Premium", tone: "cobalt" });
  if (context.freeSchoolMeals) flags.push({ label: "Free school meals", tone: "cobalt" });
  if (context.senStatus) flags.push({ label: context.senStatus, tone: "cobalt" });
  if (context.eal) flags.push({ label: "EAL", tone: "slate" });
  if (context.medicalNeeds)
    flags.push({ label: context.medicalNeeds, tone: "slate" });

  if (flags.length === 0) return null;

  const tones: Record<string, string> = {
    amber: "border-amber-300 bg-amber-50 text-amber-800",
    cobalt: "border-cobalt/30 bg-cobalt-tint text-cobalt",
    slate: "border-cloud bg-paper text-muted-foreground",
  };

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <ShieldAlert className="size-4" aria-hidden />
        Safeguarding context
      </span>
      {flags.map((f) => (
        <span
          key={f.label}
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[f.tone]}`}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}

// The domain "risk factors" — the explainable alternative to a single score.
// Each domain carries the escalation level of the signals behind it and the
// evidence that justifies it. Only domains with real evidence appear.
export function RiskFactorBreakdown({
  factors,
}: {
  factors: { domain: string; level: EscalationLevel; evidence: string[] }[];
}) {
  if (factors.length === 0) return null;
  return (
    <section>
      <h2 className="text-xl font-semibold">Risk factors</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The domains contributing to this concern, each with the evidence behind
        it. A level, never a score.
      </p>
      <Card className="mt-3 divide-y divide-cloud p-0">
        {factors.map((f) => (
          <div key={f.domain} className="flex gap-4 p-4">
            <div className="w-32 shrink-0">
              <div className="text-sm font-semibold">{f.domain}</div>
              <div className="mt-1">
                <LevelChip level={f.level} />
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-1 pt-0.5">
              {f.evidence.map((e, i) => (
                <li key={i} className="text-sm text-muted-foreground">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
    </section>
  );
}

// Case lifecycle, composed from real state. Stages a case has reached show a
// filled node; the outstanding stage is ringed; branches (e.g. dismissed at
// review) are reflected honestly rather than forced onto a linear path.
export function LifecycleStepper({
  stages,
}: {
  stages: { key: string; label: string; state: "done" | "current" | "pending" }[];
}) {
  return (
    <ol className="mt-5 flex items-center gap-1 overflow-x-auto">
      {stages.map((s, i) => (
        <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
          <div className="flex flex-col items-center gap-1.5 px-1">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                s.state === "done"
                  ? "border-cobalt bg-cobalt text-white"
                  : s.state === "current"
                    ? "border-cobalt bg-cobalt-tint text-cobalt"
                    : "border-cloud bg-card text-muted-foreground"
              }`}
              aria-hidden
            >
              {s.state === "done" ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span
              className={`whitespace-nowrap text-[11px] ${
                s.state === "pending" ? "text-muted-foreground" : "font-medium text-ink"
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < stages.length - 1 ? (
            <span
              className={`h-px flex-1 ${s.state === "done" ? "bg-cobalt/40" : "bg-cloud"}`}
              aria-hidden
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type Snapshot = {
  preferredName: string | null;
  dateOfBirth: Date | null;
  sex: string | null;
  registrationGroup: string;
  admissionDate: Date | null;
  house: string | null;
  firstLanguage: string | null;
  ethnicity: string | null;
};

function age(dob: Date): number {
  const now = new Date();
  let a = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) a -= 1;
  return a;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The pupil snapshot — personal detail, shown only once the case is revealed.
// While sealed, a placeholder makes clear the detail exists behind the reveal.
export function SnapshotPanel({ snapshot }: { snapshot: Snapshot | null }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <HeartPulse className="size-4 text-cobalt" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Pupil snapshot
        </h2>
      </div>
      {snapshot === null ? (
        <Card className="mt-3 p-4">
          <p className="text-sm text-muted-foreground">
            Personal details are sealed. Reveal the case to view them.
          </p>
        </Card>
      ) : (
        <Card className="mt-3 p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            {snapshot.preferredName ? (
              <Field label="Preferred name" value={snapshot.preferredName} />
            ) : null}
            {snapshot.dateOfBirth ? (
              <Field
                label="Date of birth"
                value={`${shortDate(snapshot.dateOfBirth)} (${age(snapshot.dateOfBirth)})`}
              />
            ) : null}
            <Field label="Tutor group" value={snapshot.registrationGroup} />
            {snapshot.house ? <Field label="House" value={snapshot.house} /> : null}
            {snapshot.sex ? <Field label="Sex" value={snapshot.sex} /> : null}
            {snapshot.admissionDate ? (
              <Field label="Admitted" value={shortDate(snapshot.admissionDate)} />
            ) : null}
            {snapshot.firstLanguage ? (
              <Field label="First language" value={snapshot.firstLanguage} />
            ) : null}
            {snapshot.ethnicity ? (
              <Field label="Ethnicity" value={snapshot.ethnicity} />
            ) : null}
          </dl>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
