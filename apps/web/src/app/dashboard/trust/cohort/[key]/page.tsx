import { redirect } from "next/navigation";
import { Brain } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../shell/breadcrumbs";

// Cohort view (spec 5.3): one cross-school pattern, its by-school breakdown, and
// what Watch recommends.
export default async function CohortPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const api = await serverApi();

  let data;
  try {
    data = await api.cohort.detail({ key });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      redirect("/dashboard/trust");
    }
    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Trust overview", href: "/dashboard/trust" },
          { label: "Cross-school pattern" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>

      <Card className="mt-4 p-5">
        <p className="text-sm leading-relaxed">{data.summary}</p>
      </Card>

      <h2 className="mt-8 text-xl font-semibold">By school</h2>
      <ul className="mt-3 overflow-hidden rounded-lg border border-cloud bg-card">
        {data.rows.map((r) => (
          <li
            key={r.school}
            className="flex items-center justify-between border-b border-cloud px-4 py-3 last:border-b-0"
          >
            <span className="text-sm font-medium">{r.school}</span>
            <span className="text-lg font-semibold tabular-nums text-cobalt">
              {r.count}
            </span>
          </li>
        ))}
      </ul>

      <Card className="mt-8 border-cobalt/30 p-5">
        <div className="flex items-center gap-2">
          <Brain className="size-5 text-cobalt" aria-hidden />
          <h2 className="text-lg font-semibold">What Watch recommends</h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{data.recommendation}</p>
      </Card>
    </div>
  );
}
