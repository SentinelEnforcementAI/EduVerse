import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../shell/breadcrumbs";
import { DocTypeIcon } from "../school/[schoolId]/documents/doc-icon";

// The trust-wide document repository (spec 5.9): every school's safeguarding
// documents in one place for a director. Read across schools, each through its
// own RLS context; a case document stays sealed by construction. Director-only.
export default async function TrustDocumentsPage() {
  const api = await serverApi();

  let vault;
  try {
    vault = await api.documents.trustVault();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

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
          The trust safeguarding repository — every school&apos;s policies,
          records, training and returns in one place. Each document is held in
          its school&apos;s vault; open one to read it in full.
        </p>
      </div>

      {/* Headline coverage */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Schools
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {vault.totals.schools}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Documents
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {vault.totals.documents}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {vault.totals.current}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Document types
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {vault.types.length}
          </div>
        </Card>
      </div>

      {/* Per-school coverage */}
      <h2 className="mt-10 text-xl font-semibold">By school</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Repository coverage per school. Open a school to search and read its
        documents in full.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {vault.schools.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/school/${s.id}/documents`}
            className="group flex items-center gap-4 rounded-xl border border-cloud bg-card p-4 transition-colors hover:border-cobalt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {s.total} {s.total === 1 ? "document" : "documents"} ·{" "}
                {s.current} current
                {s.latest
                  ? ` · latest ${s.latest.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : ""}
              </div>
            </div>
            <ChevronRight
              className="size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-cobalt"
              aria-hidden
            />
          </Link>
        ))}
      </div>

      {/* Document type breakdown */}
      {vault.types.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {vault.types.map((t) => (
            <span
              key={t.type}
              className="rounded-full border border-cloud bg-card px-3 py-1 text-xs text-muted-foreground"
            >
              {t.type} · {t.count}
            </span>
          ))}
        </div>
      ) : null}

      {/* Every document across the trust */}
      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">All documents</h2>
        <span className="text-sm text-muted-foreground">
          {vault.documents.length}{" "}
          {vault.documents.length === 1 ? "document" : "documents"}
        </span>
      </div>
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
    </div>
  );
}
