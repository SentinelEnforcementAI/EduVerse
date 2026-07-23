import { notFound, redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
import { TriageList } from "../../../../shell/triage-list";

const KEYS = ["active", "awaiting"] as const;
type Key = (typeof KEYS)[number];

// Triage list at school scope (spec 5.4), the working list behind a school
// overview KPI card.
export default async function SchoolTriagePage({
  params,
}: {
  params: Promise<{ schoolId: string; key: string }>;
}) {
  const { schoolId, key } = await params;
  if (!KEYS.includes(key as Key)) notFound();

  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  let data;
  try {
    data = await api.casework.triage({ key: key as Key, schoolId });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const schoolName = tenancy.schools.find((s) => s.id === schoolId)?.name ?? "";
  const isDirector = tenancy.mode === "mat";

  return (
    <div>
      <Breadcrumbs
        items={
          isDirector
            ? [
                { label: "Trust overview", href: "/dashboard/trust" },
                { label: schoolName, href: `/dashboard/school/${schoolId}` },
                { label: data.title },
              ]
            : [
                {
                  label: "Safeguarding overview",
                  href: `/dashboard/school/${schoolId}`,
                },
                { label: data.title },
              ]
        }
      />
      <TriageList
        title={data.title}
        subtitle={data.subtitle}
        rows={data.rows}
        showSchool={false}
        caseHref={(row) => `/dashboard/school/${row.schoolId}/case/${row.id}`}
        tabs={[
          {
            label: "Active concerns",
            href: `/dashboard/school/${schoolId}/triage/active`,
            active: key === "active",
          },
          {
            label: "Awaiting a decision",
            href: `/dashboard/school/${schoolId}/triage/awaiting`,
            active: key === "awaiting",
          },
        ]}
      />
    </div>
  );
}
