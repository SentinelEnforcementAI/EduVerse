import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, ShieldCheck } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../shell/breadcrumbs";
import { ComplianceTag } from "../../school/[schoolId]/kcsie/kcsie-actions";

// Trust KCSIE compliance table (spec 5.12): each school's overall status,
// drilling into that school's compliance.
export default async function TrustKcsiePage() {
  const api = await serverApi();
  let data;
  try {
    data = await api.kcsie.trust();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Trust overview", href: "/dashboard/trust" },
          { label: "KCSIE compliance" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">
        KCSIE compliance across the trust
      </h1>
      <p className="mt-1 text-base text-muted-foreground">
        Each school&apos;s overall status, derived from its own records.
      </p>

      {(() => {
        const upToDate = data.schools.filter((s) => s.overall === "ok").length;
        const total = data.schools.length;
        return (
          <Card className="mt-6 flex items-center gap-4 p-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div className="flex-1">
              <div className="text-lg font-semibold">
                {upToDate} of {total} schools up to date
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-cloud">
                <div
                  className="h-full rounded-full bg-cobalt"
                  style={{ width: `${total ? (upToDate / total) * 100 : 0}%` }}
                />
              </div>
            </div>
          </Card>
        );
      })()}

      <ul className="mt-4 overflow-hidden rounded-xl border border-cloud bg-card">
        {data.schools.map((s) => (
          <li key={s.id} className="border-b border-cloud last:border-b-0">
            <Link
              href={`/dashboard/school/${s.id}/kcsie`}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-paper"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                  <Building2 className="size-[18px]" aria-hidden />
                </span>
                <span className="font-medium">{s.name}</span>
                <ComplianceTag status={s.overall} />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {s.outstanding === 0
                    ? "All components up to date"
                    : `${s.outstanding} action${s.outstanding > 1 ? "s" : ""} outstanding`}
                </span>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
