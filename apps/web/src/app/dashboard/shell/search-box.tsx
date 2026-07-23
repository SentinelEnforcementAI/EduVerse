"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

// The global search field. A native GET form to /dashboard/search, so it works
// without JavaScript; the only client behaviour is the ⌘K / Ctrl-K shortcut to
// focus it. Pre-fills from the current query so the box reflects the results.
export function SearchBox() {
  const ref = useRef<HTMLInputElement>(null);
  const params = useSearchParams();
  const current = params.get("q") ?? "";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
        ref.current?.select();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form action="/dashboard/search" method="get" className="mx-auto w-full max-w-md">
      <label className="flex items-center gap-2 rounded-lg border border-cloud bg-paper px-3 py-2 text-sm text-muted-foreground focus-within:border-cobalt focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0" aria-hidden />
        <input
          ref={ref}
          type="search"
          name="q"
          defaultValue={current}
          placeholder="Search pupils, concerns, schools..."
          aria-label="Search"
          className="w-full bg-transparent text-ink outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded border border-cloud bg-card px-1.5 py-0.5 text-xs text-muted-foreground sm:inline">
          ⌘K
        </kbd>
      </label>
    </form>
  );
}
