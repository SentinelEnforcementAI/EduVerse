import Link from "next/link";
import { ChevronRight, Layers, Network } from "lucide-react";

import { Card } from "@/components/ui/card";

export type CrossSchoolPattern = {
  key: string;
  title: string;
  detail: string;
  schools: number;
  affectedSchools: string[];
  pupils: number;
  yearGroup: number;
  domainKey: string;
  domainLabel: string;
};

// A short school code for a chip, e.g. "Ashgrove Primary" -> "ASH".
function code(name: string): string {
  return name.replace(/\s+/g, "").slice(0, 3).toUpperCase();
}

function SchoolChips({ names }: { names: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((n) => (
        <span
          key={n}
          title={n}
          className="rounded bg-paper px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground"
        >
          {code(n)}
        </span>
      ))}
    </div>
  );
}

// Cross-school pattern intelligence — the trust's differentiator: concerns that
// look local at one school but read as a cohort pattern across the trust. The
// strongest pattern is featured; the rest sit in a compact grid. Cross-domain
// patterns (linked, multi-signal) get a distinct pale-cobalt tint and a
// connected-node icon, because they are Sentinel's unique value.
export function CrossSchoolPatterns({
  patterns,
  basePath,
}: {
  patterns: CrossSchoolPattern[];
  basePath: string;
}) {
  if (patterns.length === 0) return null;
  const [featured, ...rest] = patterns;
  const f = featured!;
  const featuredCross = f.domainKey === "cross-domain";

  return (
    <div className="mt-4 space-y-3">
      {/* Featured priority pattern */}
      <Link
        href={`${basePath}/${f.key}`}
        className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card
          className={`card-interactive p-5 ${featuredCross ? "bg-cobalt-tint/40" : ""}`}
        >
          <div className="flex items-start gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
              {featuredCross ? (
                <Network className="size-5" aria-hidden />
              ) : (
                <Layers className="size-5" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-cobalt">
                Priority pattern
              </span>
              <h3 className="mt-0.5 text-base font-[650]">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {f.pupils.toLocaleString("en-GB")} pupils across {f.schools}{" "}
                schools show {f.domainLabel} concerns in the same period —
                individually local, together a cohort pattern.
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <SchoolChips names={f.affectedSchools} />
                <span className="inline-flex items-center gap-1 text-sm font-medium text-cobalt">
                  Investigate pattern
                  <ChevronRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </div>
            </div>
          </div>
        </Card>
      </Link>

      {/* The remaining patterns, compact */}
      {rest.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => {
            const cross = p.domainKey === "cross-domain";
            return (
              <Link
                key={p.key}
                href={`${basePath}/${p.key}`}
                className="group block rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card
                  className={`card-interactive flex h-full flex-col p-4 ${cross ? "bg-cobalt-tint/40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-paper text-ink-muted">
                      {cross ? (
                        <Network className="size-4" aria-hidden />
                      ) : (
                        <Layers className="size-4" aria-hidden />
                      )}
                    </span>
                    <span className="text-sm font-[650] leading-snug">
                      {p.title}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.pupils.toLocaleString("en-GB")} pupils · {p.schools}{" "}
                    schools · {p.domainLabel}
                  </p>
                  <div className="mt-2">
                    <SchoolChips names={p.affectedSchools} />
                  </div>
                  <div className="mt-3 flex items-center justify-end border-t border-[var(--card-border)] pt-2.5">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-cobalt">
                      Investigate
                      <ChevronRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
