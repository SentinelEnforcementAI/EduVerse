import { Skeleton } from "@/components/ui/skeleton";

// The dashboard's intentional loading state: a skeleton in the shape of a
// typical page (title, a KPI row, a wide panel and a card grid) so a navigation
// never flashes a blank white area or a bare spinner.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-[14px]" />
        ))}
      </div>

      <Skeleton className="mt-3 h-40 rounded-[14px]" />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-[14px]" />
        ))}
      </div>
    </div>
  );
}
