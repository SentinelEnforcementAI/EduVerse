import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
import { DocTypeIcon } from "../doc-icon";
import { DownloadButton } from "./download";

// Document viewer (spec 5.10): the generated or stored document rendered in
// full, with a download.
export default async function DocumentViewerPage({
  params,
}: {
  params: Promise<{ schoolId: string; docId: string }>;
}) {
  const { schoolId, docId } = await params;
  const api = await serverApi();

  let doc;
  try {
    doc = await api.documents.byId({ schoolId, id: docId });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "NOT_FOUND")
    ) {
      redirect(`/dashboard/school/${schoolId}/documents`);
    }
    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          {
            label: "Documents",
            href: `/dashboard/school/${schoolId}/documents`,
          },
          { label: doc.title },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
            <DocTypeIcon type={doc.type} className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {doc.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {doc.type} ·{" "}
              {doc.docDate.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              · {doc.status}
            </p>
          </div>
        </div>
        <DownloadButton title={doc.title} content={doc.content} />
      </div>

      {/* A styled, sealed rendering of the document, when one is held. The
          plain-text content below remains the searchable source of record. */}
      {doc.imageDataUrl ? (
        <Card className="mx-auto mt-6 max-w-3xl overflow-hidden p-2 sm:p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={doc.imageDataUrl}
            alt={`${doc.title} (sealed document)`}
            className="h-auto w-full rounded-md"
          />
        </Card>
      ) : null}

      <Card className="mx-auto mt-6 max-w-3xl p-8">
        {doc.imageDataUrl ? (
          <p className="mb-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Document text
          </p>
        ) : null}
        <pre className="whitespace-pre-wrap font-sans text-[15px] leading-7 text-ink">
          {doc.content}
        </pre>
      </Card>
    </div>
  );
}
