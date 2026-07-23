"use client";

import Link from "next/link";
import { useState } from "react";
import { Search } from "lucide-react";

import { api } from "@/trpc/react";

// Contextual search (spec 5.9): the DSL types what they are looking for, and
// Watch matches on content and themes, showing the matched themes and a snippet
// so the match is explained, not just asserted.
export function DocumentSearch({ schoolId }: { schoolId: string }) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const search = api.documents.search.useQuery(
    { schoolId, query },
    { enabled: query.length >= 2 },
  );

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search the repository by what a document says, e.g. online safety, young carer, information sharing"
            className="w-full rounded-lg border border-cloud bg-card py-2.5 pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-cobalt px-4 py-2.5 text-sm font-medium text-white hover:bg-cobalt-deep"
        >
          Search
        </button>
      </form>

      {query.length >= 2 ? (
        <div className="mt-4">
          {search.isPending ? (
            <p className="text-sm text-muted-foreground">Searching…</p>
          ) : (
            <>
              <p className="text-sm text-ink">{search.data?.synthesis}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {search.data?.hits.map((hit) => (
                  <li key={hit.id}>
                    <Link
                      href={`/dashboard/school/${schoolId}/documents/${hit.id}`}
                      className="block rounded-lg border border-cloud p-4 transition-colors hover:border-cobalt"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">{hit.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {hit.type} · {hit.scope === "CASE" ? "Case" : "Vault"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        {hit.snippet}
                      </p>
                      {hit.matchedThemes.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {hit.matchedThemes.map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-cobalt-tint px-2 py-0.5 text-xs font-medium text-cobalt"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
