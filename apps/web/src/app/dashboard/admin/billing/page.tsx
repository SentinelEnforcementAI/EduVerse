import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { formatMoney } from "@/lib/money";
import { serverApi } from "@/trpc/server";

import { SnapshotList, TakeSnapshot } from "./billing-client";

// Billing and metering (commercialisation slice 5). A trust administrator sees
// the current basis — pupils per school, the per-pupil rate and the flat MAT
// fee — meters a period into a snapshot, and issues an invoice. Admin-only.
export default async function BillingPage() {
  const api = await serverApi();

  let basis;
  let snapshots;
  try {
    [basis, snapshots] = await Promise.all([
      api.billing.summary(),
      api.billing.snapshots(),
    ]);
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Cost per pupil plus a flat fee per trust. Metered from live pupil
        numbers. Every snapshot and invoice is audited.
      </p>

      {/* The current basis. */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-cloud bg-card p-5">
          <div className="text-sm text-muted-foreground">This trust, now</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {formatMoney(basis.totalPence, basis.currency)}
            <span className="text-base font-normal text-muted-foreground">
              {" "}
              / year
            </span>
          </div>
          <dl className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                {basis.pupilCount} pupils ×{" "}
                {formatMoney(basis.perPupilPence, basis.currency)}
              </dt>
              <dd className="tabular-nums">
                {formatMoney(basis.usagePence, basis.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Flat fee per trust</dt>
              <dd className="tabular-nums">
                {formatMoney(basis.matFeePence, basis.currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-cloud pt-1.5 font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">
                {formatMoney(basis.totalPence, basis.currency)}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            The per-pupil rate shown is provisional, pending the commercial rate.
          </p>
        </div>

        <div className="rounded-xl border border-cloud bg-card p-5">
          <div className="text-sm text-muted-foreground">Pupils per school</div>
          <ul className="mt-2 space-y-1.5 text-sm">
            {basis.schools.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  {s.pupilCount}
                </span>
              </li>
            ))}
            {basis.schools.length === 0 ? (
              <li className="text-muted-foreground">
                No schools yet — add schools in onboarding.
              </li>
            ) : null}
          </ul>
        </div>
      </div>

      {/* Metered periods + invoicing. */}
      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Billing periods</h2>
        <TakeSnapshot />
      </div>
      <div className="mt-3">
        <SnapshotList snapshots={snapshots} />
      </div>
    </div>
  );
}
