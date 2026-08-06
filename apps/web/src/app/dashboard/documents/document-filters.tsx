"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

// Filter the trust document repository by school and document type. Writes the
// choices to the URL query string (so a filtered view is shareable and the
// server does the filtering), mirroring the concerns list filters.
export function DocumentFilters({
  schools,
  types,
  statuses,
  applied,
  shown,
  total,
}: {
  schools: { id: string; name: string }[];
  types: { type: string; count: number }[];
  statuses: { status: string; count: number }[];
  applied: { schoolId?: string; type?: string; status?: string };
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const hasFilter = Boolean(applied.schoolId || applied.type || applied.status);
  const selectClass =
    "rounded-lg border border-cloud bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <select
        aria-label="School"
        value={applied.schoolId ?? ""}
        onChange={(e) => set("schoolId", e.target.value)}
        className={selectClass}
      >
        <option value="">All schools</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Document type"
        value={applied.type ?? ""}
        onChange={(e) => set("type", e.target.value)}
        className={selectClass}
      >
        <option value="">All types</option>
        {types.map((t) => (
          <option key={t.type} value={t.type}>
            {t.type} ({t.count})
          </option>
        ))}
      </select>

      <select
        aria-label="Status"
        value={applied.status ?? ""}
        onChange={(e) => set("status", e.target.value)}
        className={selectClass}
      >
        <option value="">All statuses</option>
        <option value="review">Needs review</option>
        {statuses.map((s) => (
          <option key={s.status} value={s.status}>
            {s.status} ({s.count})
          </option>
        ))}
      </select>

      {hasFilter ? (
        <button
          type="button"
          onClick={() => router.replace(pathname, { scroll: false })}
          className="text-sm font-medium text-cobalt hover:underline"
        >
          Clear
        </button>
      ) : null}

      <span className="ml-auto text-sm text-muted-foreground">
        {hasFilter ? `${shown} of ${total}` : total}{" "}
        {total === 1 ? "document" : "documents"}
      </span>
    </div>
  );
}
