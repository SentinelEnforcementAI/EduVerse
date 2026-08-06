import { notFound, redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
import { TriageFilters } from "../../../../shell/triage-filters";
import { TriageList } from "../../../../shell/triage-list";
import { parseTriageFilters } from "../../../../shell/triage-params";
import { RaiseConcernDialog } from "./raise-concern-dialog";

const KEYS = ["active", "awaiting"] as const;
type Key = (typeof KEYS)[number];

// Triage list at school scope (spec 5.4), the working list behind a school
// overview KPI card.
export default async function SchoolTriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ schoolId: string; key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { schoolId, key } = await params;
  if (!KEYS.includes(key as Key)) notFound();

  // The school is fixed by the route; other filters come from the query string.
  const filters = parseTriageFilters(await searchParams);
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  let data;
  try {
    data = await api.casework.triage({ ...filters, key: key as Key, schoolId });
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
        action={<RaiseConcernDialog schoolId={schoolId} />}
        caseHref={(row) => `/dashboard/school/${row.schoolId}/case/${row.id}`}
        filters={
          <TriageFilters
            facets={data.facets}
            applied={data.applied}
            showSchool={false}
            shown={data.rows.length}
            total={data.total}
          />
        }
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
