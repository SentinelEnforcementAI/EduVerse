import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { SchoolCard } from "../shell/school-card";

// Schools (director): every school in the trust as a card with its risk band,
// live caseload shape and behaviour trend, each drilling into that school's
// overview. Director-only.
export default async function SchoolsPage() {
  const api = await serverApi();

  let data;
  try {
    data = await api.overview.trust();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
      <p className="mt-1 text-base text-muted-foreground">
        {data.trustName} · {data.metrics.schools} schools. Each school&apos;s
        risk band and caseload at a glance.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.schools.map((school) => (
          <SchoolCard key={school.id} school={school} />
        ))}
      </div>
    </div>
  );
}
