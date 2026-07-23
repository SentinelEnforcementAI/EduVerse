import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../shell/breadcrumbs";
import { DocTypeIcon } from "./doc-icon";
import { DocumentSearch } from "./document-search";
import { EvidencePackButton } from "./evidence-pack";
import { TrainingReader } from "./training-reader";

// Documents (spec 5.9): the org vault and contextual search over the whole
// repository. Case documents are searchable too, sealed by construction.
export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  let vault;
  try {
    vault = await api.documents.vault({ schoolId });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "BAD_REQUEST")
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const isDirector = tenancy.mode === "mat";

  return (
    <div>
      <Breadcrumbs
        items={
          isDirector
            ? [
                { label: "Trust overview", href: "/dashboard/trust" },
                { label: vault.schoolName, href: `/dashboard/school/${schoolId}` },
                { label: "Documents" },
              ]
            : [
                {
                  label: "Safeguarding overview",
                  href: `/dashboard/school/${schoolId}`,
                },
                { label: "Documents" },
              ]
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="mt-1 text-base text-muted-foreground">
            {vault.schoolName} repository. Search matches what a document says,
            not its filename.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <TrainingReader schoolId={schoolId} />
          <EvidencePackButton schoolId={schoolId} />
        </div>
      </div>

      <div className="mt-6">
        <DocumentSearch schoolId={schoolId} />
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">Vault</h2>
        <span className="text-sm text-muted-foreground">
          {vault.documents.length}{" "}
          {vault.documents.length === 1 ? "document" : "documents"}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {vault.documents.map((d) => {
          return (
            <li key={d.id}>
              <Link
                href={`/dashboard/school/${schoolId}/documents/${d.id}`}
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
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.summary}
                  </p>
                  {d.themes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {d.themes.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-cloud px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <ChevronRight
                  className="size-5 shrink-0 self-center text-muted-foreground transition-colors group-hover:text-cobalt"
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
