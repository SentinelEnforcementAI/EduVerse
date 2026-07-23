import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{doc.title}</h1>
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
        <DownloadButton title={doc.title} content={doc.content} />
      </div>

      <Card className="mt-6 p-6">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink">
          {doc.content}
        </pre>
      </Card>
    </div>
  );
}
