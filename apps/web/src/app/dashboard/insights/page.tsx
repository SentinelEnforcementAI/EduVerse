import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Network } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

// Insights (director): cross-school pattern intelligence in full. Concerns that
// cross school boundaries, that no single school can see. Director-only.
export default async function InsightsPage() {
  const api = await serverApi();

  let data;
  try {
    data = await api.cohort.patterns();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Cross-school pattern intelligence. What looks local at one school reads
        as a cohort pattern across the trust.
      </p>

      {data.patterns.length === 0 ? (
        <Card className="mt-6 p-6 text-base text-muted-foreground">
          No cross-school patterns this period. Watch compares concerns across
          every school and surfaces the ones that cross a boundary here.
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.patterns.map((p) => (
            <Link
              key={p.key}
              href={`/dashboard/trust/cohort/${p.key}`}
              className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full p-5 transition-colors group-hover:border-cobalt">
                <span className="flex size-9 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                  <Network className="size-[18px]" aria-hidden />
                </span>
                <div className="mt-3 text-base font-semibold leading-snug">
                  {p.title}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {p.detail}
                </div>
                <div className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-cobalt">
                  Investigate
                  <ChevronRight className="size-4" aria-hidden />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
