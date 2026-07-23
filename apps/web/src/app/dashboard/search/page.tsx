import Link from "next/link";
import { Building2, ChevronRight, Search } from "lucide-react";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { LevelChip } from "../shell/level-chip";
import { SealedAvatar } from "../shell/sealed-avatar";

// Search results (global search). Grouped: schools, then concerns. Sealed by
// construction — a concern shows a reference, a level and a reason, never a
// name. Opening a case is what audits the read of a child's record.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const api = await serverApi();
  const data = await api.search.query({ q });
  const total = data.schools.length + data.concerns.length;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
      {data.q ? (
        <p className="mt-1 text-base text-muted-foreground">
          {total} {total === 1 ? "result" : "results"} for{" "}
          <span className="font-medium text-ink">“{data.q}”</span>
        </p>
      ) : (
        <p className="mt-1 text-base text-muted-foreground">
          Search for a pupil reference, a concern, or a school.
        </p>
      )}

      {data.q && total === 0 ? (
        <Card className="mt-6 flex items-center gap-3 p-6 text-base text-muted-foreground">
          <Search className="size-5 shrink-0" aria-hidden />
          Nothing matched “{data.q}”. Try a pupil reference (for example
          &ldquo;0001&rdquo;), a school name, or a word from a concern.
        </Card>
      ) : null}

      {data.schools.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Schools
          </h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-cloud bg-card">
            {data.schools.map((s) => (
              <li key={s.id} className="border-b border-cloud last:border-b-0">
                <Link
                  href={`/dashboard/school/${s.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                    <Building2 className="size-[18px]" aria-hidden />
                  </span>
                  <span className="flex-1 font-medium">{s.name}</span>
                  <ChevronRight
                    className="size-5 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.concerns.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Concerns
          </h2>
          <ul className="mt-3 overflow-hidden rounded-xl border border-cloud bg-card">
            {data.concerns.map((c) => (
              <li key={c.id} className="border-b border-cloud last:border-b-0">
                <Link
                  href={`/dashboard/school/${c.schoolId}/case/${c.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <SealedAvatar refLabel={c.ref} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="font-semibold">{c.ref}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        Year {c.yearGroup}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {c.schoolName}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-muted-foreground">
                      {c.headline}
                    </div>
                  </div>
                  <LevelChip level={c.level} className="hidden sm:inline-flex" />
                  <ChevronRight
                    className="size-5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
