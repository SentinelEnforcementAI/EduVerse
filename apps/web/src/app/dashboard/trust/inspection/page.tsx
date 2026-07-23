import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../shell/breadcrumbs";

// Inspection readiness at trust scope (spec 5.14): the thread rolled up, and
// each school's readiness.
export default async function TrustInspectionPage() {
  const api = await serverApi();
  let data;
  try {
    data = await api.inspection.trust();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  const rollup: [string, number][] = [
    ["Patterns surfaced", data.rollup.surfaced],
    ["Active concerns", data.rollup.active],
    ["Referrals", data.rollup.referrals],
    ["Audit entries", data.rollup.auditEntries],
  ];

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Trust overview", href: "/dashboard/trust" },
          { label: "Inspection readiness" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">
        Inspection readiness across the trust
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        The golden thread, rolled up, with each school&apos;s readiness.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rollup.map(([label, value]) => (
          <Card key={label} className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{value}</div>
          </Card>
        ))}
      </div>

      <ul className="mt-6 overflow-hidden rounded-lg border border-cloud bg-card">
        {data.schools.map((s) => (
          <li key={s.id} className="border-b border-cloud last:border-b-0">
            <Link
              href={`/dashboard/school/${s.id}/inspection`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-paper"
            >
              <span className="font-medium">{s.name}</span>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>KCSIE: {s.complianceLabel}</span>
                <span>{s.active} active</span>
                <ChevronRight className="size-4" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
