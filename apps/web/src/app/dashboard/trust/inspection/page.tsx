import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Building2,
  ChevronRight,
  Flag,
  ScanSearch,
  ScrollText,
  Send,
  type LucideIcon,
} from "lucide-react";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../shell/breadcrumbs";
import { KpiCard } from "../../shell/kpi";

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

  const rollup: [string, number, LucideIcon][] = [
    ["Patterns surfaced", data.rollup.surfaced, ScanSearch],
    ["Active concerns", data.rollup.active, Flag],
    ["Referrals", data.rollup.referrals, Send],
    ["Audit entries", data.rollup.auditEntries, ScrollText],
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
        {rollup.map(([label, value, icon]) => (
          <KpiCard key={label} label={label} value={value} icon={icon} />
        ))}
      </div>

      <h2 className="mt-8 text-xl font-semibold">School readiness</h2>
      <ul className="mt-4 overflow-hidden rounded-xl border border-cloud bg-card">
        {data.schools.map((s) => (
          <li key={s.id} className="border-b border-cloud last:border-b-0">
            <Link
              href={`/dashboard/school/${s.id}/inspection`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-paper"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                  <Building2 className="size-[18px]" aria-hidden />
                </span>
                <span className="font-medium">{s.name}</span>
              </span>
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
