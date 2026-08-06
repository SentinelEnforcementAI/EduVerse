import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../shell/breadcrumbs";
import { DocTypeIcon } from "../school/[schoolId]/documents/doc-icon";
import { DocumentFilters } from "./document-filters";
import { TrustDocumentSearch } from "./trust-document-search";

// The trust-wide document repository (spec 5.9): every school's safeguarding
// documents in one place for a director, with conversational search and
// filtering. Read across schools, each through its own RLS context; a case
// document stays sealed by construction. Director-only.
export default async function TrustDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) || undefined;
  const api = await serverApi();

  let vault;
  try {
    vault = await api.documents.trustVault({
      schoolId: one(sp.schoolId),
      type: one(sp.type),
      status: one(sp.status),
    });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  const t = vault.totals;
  const currentPct = t.documents
    ? Math.round((t.current / t.documents) * 100)
    : 100;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Trust overview", href: "/dashboard/trust" },
          { label: "Documents" },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="mt-1 text-base text-muted-foreground">
          Search safeguarding policies, records, training evidence and statutory
          returns across every school in the trust.
        </p>
      </div>

      {/* Conversational search across every school */}
      <div className="mt-6">
        <TrustDocumentSearch />
      </div>

      {/* Actionable coverage — current % and a needs-review action card */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total documents
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {t.documents.toLocaleString("en-GB")}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {t.current.toLocaleString("en-GB")}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {currentPct}% current
          </div>
        </Card>
        <Link
          href="/dashboard/documents?status=review"
          className="group rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Card
            className={`card-interactive h-full p-4 ${t.needsReview > 0 ? "border-warning/40 bg-warning-tint/40" : ""}`}
          >
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t.needsReview > 0 ? (
                <AlertTriangle className="size-3.5 text-warning" aria-hidden />
              ) : null}
              Need review
            </div>
            <div
              className={`mt-1 text-2xl font-semibold tabular-nums ${t.needsReview > 0 ? "text-warning" : ""}`}
            >
              {t.needsReview.toLocaleString("en-GB")}
            </div>
          </Card>
        </Link>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Schools covered
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {t.schools.toLocaleString("en-GB")}
          </div>
        </Card>
      </div>

      {/* Per-school coverage, with a current-document progress bar */}
      <h2 className="mt-10 text-xl font-semibold">By school</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Repository health per school. Open a school to search and read its
        documents in full.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {vault.schools.map((s) => {
          const pct = s.total ? Math.round((s.current / s.total) * 100) : 100;
          const dot =
            pct >= 90 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-risk";
          return (
            <Link
              key={s.id}
              href={`/dashboard/school/${s.id}/documents`}
              className="group rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="card-interactive p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <span
                        aria-hidden
                        className={`size-2 shrink-0 rounded-full ${dot}`}
                      />
                      {s.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.total} {s.total === 1 ? "document" : "documents"} ·{" "}
                      {s.current} current
                      {s.needsReview > 0 ? (
                        <>
                          {" · "}
                          <span className="font-medium text-warning">
                            {s.needsReview} need review
                          </span>
                        </>
                      ) : null}
                    </div>
                    {s.latest ? (
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Latest update{" "}
                        {s.latest.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {pct}%
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-paper">
                  <div
                    className={`h-full rounded-full ${pct >= 90 ? "bg-success" : pct >= 70 ? "bg-warning" : "bg-risk"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Every document across the trust, filterable by school and type */}
      <h2 className="mt-10 text-xl font-semibold">All documents</h2>
      <DocumentFilters
        schools={vault.schools.map((s) => ({ id: s.id, name: s.name }))}
        types={vault.types}
        statuses={vault.statuses}
        applied={vault.applied}
        shown={vault.shown}
        total={vault.total}
      />
      {vault.documents.length === 0 ? (
        <Card className="mt-3 p-6 text-sm text-muted-foreground">
          No documents match this filter.
        </Card>
      ) : (
      <ul className="mt-3 flex flex-col gap-2">
        {vault.documents.map((d) => (
          <li key={d.id}>
            <Link
              href={`/dashboard/school/${d.schoolId}/documents/${d.id}`}
              className="group flex gap-4 rounded-xl border border-cloud bg-card p-4 transition-colors hover:border-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
                <DocTypeIcon type={d.type} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.type} ·{" "}
                    {d.docDate.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    · {d.status}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-paper px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {d.schoolName}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {d.summary}
                  </p>
                </div>
              </div>
              <ChevronRight
                className="size-5 shrink-0 self-center text-muted-foreground transition-colors group-hover:text-cobalt"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
