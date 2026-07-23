import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../../shell/breadcrumbs";
import { ComplianceTag } from "../kcsie-actions";
import { Workspace } from "./workspace";

// KCSIE component workspace (spec 5.13): owner, tasks, evidence, activity.
export default async function KcsieComponentPage({
  params,
}: {
  params: Promise<{ schoolId: string; key: string }>;
}) {
  const { schoolId, key } = await params;
  const api = await serverApi();

  let data;
  try {
    data = await api.kcsie.component({ schoolId, key });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
    ) {
      redirect(`/dashboard/school/${schoolId}/kcsie`);
    }
    throw error;
  }

  return (
    <div>
      <Breadcrumbs
        items={[
          {
            label: "KCSIE compliance",
            href: `/dashboard/school/${schoolId}/kcsie`,
          },
          { label: data.component.label },
        ]}
      />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {data.component.label}
        </h1>
        <ComplianceTag status={data.component.status} />
      </div>
      <p className="mt-1 text-base text-muted-foreground">
        {data.component.detail} · {data.component.due} · Owner: {data.owner}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <section>
            <h2 className="text-xl font-semibold">Tasks and evidence</h2>
            <Card className="mt-3 p-5">
              <Workspace
                schoolId={schoolId}
                componentKey={key}
                tasks={data.tasks}
                availableDocuments={data.availableDocuments}
              />
            </Card>
          </section>

          {data.evidence.length > 0 ? (
            <section>
              <h2 className="text-xl font-semibold">Attached evidence</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {data.evidence.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/dashboard/school/${schoolId}/documents/${d.id}`}
                      className="flex items-center gap-2 rounded-lg border border-cloud p-3 text-sm transition-colors hover:border-cobalt"
                    >
                      <FileText className="size-4 text-muted-foreground" aria-hidden />
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <Card className="h-fit p-5">
          <h3 className="text-base font-semibold">Activity</h3>
          {data.activity.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No activity yet.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {data.activity.map((a) => (
                <li key={a.id} className="text-sm">
                  <span className="tabular-nums text-muted-foreground">
                    {a.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>{" "}
                  · {a.action}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
