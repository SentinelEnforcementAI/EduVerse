import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../shell/breadcrumbs";
import { ComplianceTag, KcsieActions } from "./kcsie-actions";

// KCSIE compliance for a school (spec 5.12): seven components, each derived from
// the school's records, with the section 175 pre-fill and the governor pack.
export default async function KcsiePage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  let data;
  try {
    data = await api.kcsie.school({ schoolId });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "BAD_REQUEST")
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const isDirector = tenancy.mode === "mat";

  return (
    <div>
      <Breadcrumbs
        items={
          isDirector
            ? [
                { label: "Trust overview", href: "/dashboard/trust" },
                { label: data.schoolName, href: `/dashboard/school/${schoolId}` },
                { label: "KCSIE compliance" },
              ]
            : [
                {
                  label: "Safeguarding overview",
                  href: `/dashboard/school/${schoolId}`,
                },
                { label: "KCSIE compliance" },
              ]
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            KCSIE compliance
          </h1>
          <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
            {data.schoolName} · <ComplianceTag status={data.overall} />
          </p>
        </div>
        <KcsieActions schoolId={schoolId} />
      </div>

      <ul className="mt-6 overflow-hidden rounded-lg border border-cloud bg-card">
        {data.components.map((c) => (
          <li
            key={c.key}
            className="flex flex-wrap items-center justify-between gap-3 border-b border-cloud px-4 py-4 last:border-b-0"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.label}</span>
                <ComplianceTag status={c.status} />
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {c.detail} · {c.due}
              </div>
            </div>
            <Link
              href={`/dashboard/school/${schoolId}/kcsie/${c.key}`}
              className="inline-flex items-center gap-1 text-sm font-medium text-cobalt hover:underline"
            >
              Workspace
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
