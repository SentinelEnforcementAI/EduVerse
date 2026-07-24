import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Cable, CheckCircle2, Rocket, Users } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { AddSchoolForm } from "./onboarding-client";

// Guided onboarding for a trust administrator (commercialisation slice 2). Once
// a customer's silo stack is provisioned — trust + first admin created — the
// admin finishes setup here: add the schools, invite the safeguarding leads,
// then connect Wonde (slice 3). A live checklist shows what is done and what is
// still needed. Admin-only: a non-admin who reaches this URL is sent home.
export default async function OnboardingPage() {
  const api = await serverApi();

  let state;
  try {
    state = await api.admin.onboarding();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  const doneCount = [state.steps.schools, state.steps.dsls].filter(
    Boolean,
  ).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Onboarding</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Set up {state.trust.name} for safeguarding. Add your schools, invite the
        leads, and connect your data. Every step is audited.
      </p>

      {state.ready ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-cobalt/30 bg-cobalt-tint px-4 py-3">
          <Rocket className="mt-0.5 size-5 shrink-0 text-cobalt" aria-hidden />
          <div>
            <p className="font-semibold text-cobalt">You’re ready to work.</p>
            <p className="text-sm text-muted-foreground">
              Schools and safeguarding leads are in place. Connect Wonde when
              you’re ready to bring in live data.
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-6 text-sm font-medium text-muted-foreground">
          {doneCount} of 2 core steps complete
        </p>
      )}

      <ol className="mt-6 space-y-4">
        {/* Step 1 — Trust (always done: you're signed in as its admin) */}
        <Step
          done
          icon={Building2}
          n={1}
          title="Your trust is set up"
          description={`${state.trust.name} is provisioned and you’re signed in as its administrator.`}
        />

        {/* Step 2 — Schools */}
        <Step
          done={state.steps.schools}
          icon={Building2}
          n={2}
          title="Add your schools"
          description="Each school is an isolated tenant. Add one row per school in the trust."
        >
          {state.schools.length > 0 ? (
            <ul className="mb-4 divide-y divide-cloud overflow-hidden rounded-lg border border-cloud">
              {state.schools.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-muted-foreground">
                    {s.dslCount === 1
                      ? "1 DSL"
                      : `${s.dslCount} DSLs`}
                  </span>
                  {s.wondeLinked ? (
                    <span className="rounded-full bg-cobalt-tint px-2 py-0.5 text-xs font-semibold text-cobalt">
                      Wonde linked
                    </span>
                  ) : (
                    <span className="rounded-full bg-cloud px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                      No data source
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">
              No schools yet. Add your first below.
            </p>
          )}
          <AddSchoolForm />
        </Step>

        {/* Step 3 — DSLs */}
        <Step
          done={state.steps.dsls}
          icon={Users}
          n={3}
          title="Invite safeguarding leads"
          description="Invite a DSL for each school. Sign-in stays invite-only — they request a link once invited."
        >
          <p className="mb-3 text-sm text-muted-foreground">
            {state.totals.dsls === 0
              ? "No DSLs invited yet."
              : `${state.totals.dsls} DSL${
                  state.totals.dsls === 1 ? "" : "s"
                } invited across the trust.`}
          </p>
          <Link
            href="/dashboard/admin/users"
            className="inline-flex items-center gap-2 rounded-md bg-cobalt px-3 py-1.5 text-sm font-semibold text-white hover:bg-cobalt/90"
          >
            <Users className="size-4" aria-hidden />
            Invite on the Users page
          </Link>
        </Step>

        {/* Step 4 — Wonde (slice 3: pending, not yet actionable) */}
        <Step
          done={false}
          pending
          icon={Cable}
          n={4}
          title="Connect Wonde"
          description="Bring in attendance, behaviour and attainment from your MIS, so the risk engine has data to work with."
        >
          <span className="inline-flex items-center gap-2 rounded-md border border-dashed border-cloud px-3 py-1.5 text-sm text-muted-foreground">
            Coming soon — self-connect is next in the rollout.
          </span>
        </Step>
      </ol>
    </div>
  );
}

// One onboarding step: a numbered/checked marker, a title and description, and
// optional inline content (a form, a list, an action).
function Step({
  done,
  pending,
  icon: Icon,
  n,
  title,
  description,
  children,
}: {
  done: boolean;
  pending?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  n: number;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-4 rounded-xl border border-cloud bg-card p-5">
      <div className="shrink-0">
        {done ? (
          <CheckCircle2 className="size-7 text-cobalt" aria-label="Done" />
        ) : (
          <span
            className={`flex size-7 items-center justify-center rounded-full border text-sm font-semibold ${
              pending
                ? "border-cloud text-muted-foreground"
                : "border-cobalt text-cobalt"
            }`}
          >
            {n}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{title}</h2>
          {done ? (
            <span className="rounded-full bg-cobalt-tint px-2 py-0.5 text-xs font-semibold text-cobalt">
              Done
            </span>
          ) : pending ? (
            <span className="rounded-full bg-cloud px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              Later
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        {children ? <div className="mt-4">{children}</div> : null}
      </div>
    </li>
  );
}
