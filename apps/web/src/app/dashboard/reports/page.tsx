import { FileBarChart } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  buildSchoolTermlyReport,
  buildTrustTermlyReport,
} from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { ReportPanel } from "../shell/report-panel";

// Reports: the governance reports available to the caller, generated from the
// real computed figures (no invented numbers). A director gets the trust termly
// report; a DSL gets their school's.
export default async function ReportsPage() {
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();
  const now = new Date();

  let title: string;
  let filename: string;
  let content: string;
  let scopeLabel: string;

  if (tenancy.mode === "mat") {
    const data = await api.overview.trust();
    scopeLabel = `${data.trustName} · ${data.metrics.schools} schools`;
    title = "Termly governance report";
    filename = "termly-governance-report.txt";
    content = buildTrustTermlyReport({
      trustName: data.trustName,
      generatedOn: now,
      pupilsOnRoll: data.metrics.pupilsOnRoll,
      activeConcerns: data.metrics.activeConcerns,
      awaitingDecision: data.metrics.awaitingDecision,
      schools: data.schools,
    });
  } else {
    const schoolId = tenancy.schools[0]!.id;
    const data = await api.overview.school({ schoolId });
    scopeLabel = data.school.name;
    title = "Termly safeguarding report";
    filename = "termly-safeguarding-report.txt";
    content = buildSchoolTermlyReport({
      schoolName: data.school.name,
      generatedOn: now,
      pupilsOnRoll: data.metrics.pupilsOnRoll,
      activeConcerns: data.metrics.activeConcerns,
      awaitingDecision: data.metrics.awaitingDecision,
      reviewed: data.metrics.reviewed,
    });
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Generate board-ready safeguarding reports from the trust&apos;s live
        data.
      </p>

      <Card className="mt-6 max-w-2xl p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
            <FileBarChart className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{scopeLabel}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A termly summary of the safeguarding picture: pupils on roll,
              active concerns, and what is awaiting a decision. Preview it, then
              download to share with trustees or governors.
            </p>
            <div className="mt-4">
              <ReportPanel
                triggerLabel="Open report"
                title={title}
                filename={filename}
                content={content}
              />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
