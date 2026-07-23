import Link from "next/link";
import { redirect } from "next/navigation";
import {
  GraduationCap,
  ScanSearch,
  Send,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { TRPCError } from "@trpc/server";

import { Card } from "@/components/ui/card";
import { serverApi } from "@/trpc/server";

import { Breadcrumbs } from "../../../shell/breadcrumbs";
import { EvidencePackButton } from "../documents/evidence-pack";
import { ComplianceTag } from "../kcsie/kcsie-actions";

// Inspection readiness (spec 5.14): the golden thread from policy and training,
// through identification and action, to assurance. Every figure is real, and
// the evidence pack assembles the underlying documents.
export default async function InspectionPage({
  params,
}: {
  params: Promise<{ schoolId: string }>;
}) {
  const { schoolId } = await params;
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();

  let data;
  try {
    data = await api.inspection.school({ schoolId });
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "FORBIDDEN" || error.code === "BAD_REQUEST")
    ) {
      redirect("/dashboard");
    }
    throw error;
  }

  const t = data.thread;
  const isDirector = tenancy.mode === "mat";

  const strands: {
    title: string;
    icon: LucideIcon;
    rows: [string, string | number][];
  }[] = [
    {
      title: "Policy and training",
      icon: GraduationCap,
      rows: [
        ["KCSIE compliance", t.compliance.overallLabel],
        ["Policies and records on file", t.assurance.policies],
      ],
    },
    {
      title: "Identification",
      icon: ScanSearch,
      rows: [
        ["Patterns surfaced", t.identification.surfaced],
        ["Active concerns", t.identification.active],
        ["Reviewed and recorded", t.identification.reviewed],
      ],
    },
    {
      title: "Action",
      icon: Send,
      rows: [
        ["Referrals", t.action.referrals],
        ["Case documents filed", t.action.caseDocuments],
      ],
    },
    {
      title: "Assurance",
      icon: ShieldCheck,
      rows: [["Audit entries", t.assurance.auditEntries]],
    },
  ];

  return (
    <div>
      <Breadcrumbs
        items={
          isDirector
            ? [
                { label: "Trust overview", href: "/dashboard/trust" },
                { label: data.schoolName, href: `/dashboard/school/${schoolId}` },
                { label: "Inspection readiness" },
              ]
            : [
                {
                  label: "Safeguarding overview",
                  href: `/dashboard/school/${schoolId}`,
                },
                { label: "Inspection readiness" },
              ]
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Inspection readiness
          </h1>
          <p className="mt-1 flex items-center gap-2 text-base text-muted-foreground">
            {data.schoolName} · the golden thread ·{" "}
            <ComplianceTag status={t.compliance.overall} />
          </p>
        </div>
        <EvidencePackButton schoolId={schoolId} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {strands.map((strand, i) => {
          const Icon = strand.icon;
          return (
            <Card key={strand.title} className="flex flex-col p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Stage {i + 1}
                  </div>
                  <h2 className="text-base font-semibold leading-tight">
                    {strand.title}
                  </h2>
                </div>
              </div>
              <dl className="mt-4 flex flex-col gap-2 border-t border-cloud pt-3">
                {strand.rows.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-2"
                  >
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/dashboard/school/${schoolId}/kcsie`}
          className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
        >
          KCSIE compliance
        </Link>
        <Link
          href={`/dashboard/school/${schoolId}/documents`}
          className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
        >
          Documents
        </Link>
        <Link
          href="/dashboard/audit"
          className="rounded-md border border-cloud px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-ink hover:text-ink"
        >
          Audit log
        </Link>
      </div>
    </div>
  );
}
