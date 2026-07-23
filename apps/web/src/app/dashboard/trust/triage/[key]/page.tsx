import { notFound, redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../shell/breadcrumbs";
import { TriageList } from "../../../shell/triage-list";

const KEYS = ["active", "awaiting"] as const;
type Key = (typeof KEYS)[number];

// Triage list at trust scope (spec 5.4), the working list behind a trust
// overview KPI card. Director-only; shows which school each case belongs to.
export default async function TrustTriagePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  if (!KEYS.includes(key as Key)) notFound();

  const api = await serverApi();
  let data;
  try {
    data = await api.casework.triage({ key: key as Key });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  // A DSL (single school) has no trust triage — send them to their own.
  if (data.scope !== "trust") {
    redirect("/dashboard");
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Trust overview", href: "/dashboard/trust" },
          { label: data.title },
        ]}
      />
      <TriageList
        title={`${data.title} across the trust`}
        subtitle={data.subtitle}
        rows={data.rows}
        showSchool
        caseHref={(row) => `/dashboard/school/${row.schoolId}/case/${row.id}`}
      />
    </div>
  );
}
