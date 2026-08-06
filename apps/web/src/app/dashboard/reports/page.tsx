import { FileBarChart } from "lucide-react";

import { Card } from "@/components/ui/card";
import {
  buildSchoolTermlyReport,
  buildTrustTermlyReport,
} from "@/server/reports/termly";
import { serverApi } from "@/trpc/server";

import { ReportDrawer, type ReportData } from "./report-drawer";

// The academic term a date falls in (English school year: Autumn Sep–Dec,
// Spring Jan–Apr, Summer May–Jul; Aug is treated as the incoming Autumn term).
function termLabel(d: Date): string {
  const m = d.getMonth();
  const y = d.getFullYear();
  if (m >= 7) return `Autumn term ${y}`;
  if (m <= 3) return `Spring term ${y}`;
  return `Summer term ${y}`;
}

// Reports: board-ready governance reports generated from the trust's live data.
// A director gets the trust termly report; a DSL gets their school's.
export default async function ReportsPage() {
  const api = await serverApi();
  const tenancy = await api.overview.tenancy();
  const now = new Date();
  const period = termLabel(now);
  const generatedOn = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const n = (v: number) => v.toLocaleString("en-GB");

  let report: ReportData;

  if (tenancy.mode === "mat") {
    const data = await api.overview.trust();
    const text = buildTrustTermlyReport({
      trustName: data.trustName,
      generatedOn: now,
      pupilsOnRoll: data.metrics.pupilsOnRoll,
      activeConcerns: data.metrics.activeConcerns,
      awaitingDecision: data.metrics.awaitingDecision,
      schools: data.schools,
    });
    report = {
      title: "Termly governance report",
      scopeName: `${data.trustName} · ${data.metrics.schools} schools`,
      period,
      generatedOn,
      metrics: [
        { label: "Pupils on roll", value: n(data.metrics.pupilsOnRoll) },
        { label: "Active concerns", value: n(data.metrics.activeConcerns) },
        { label: "Awaiting decision", value: n(data.metrics.awaitingDecision) },
      ],
      schools: data.schools.map((s) => ({
        name: s.name,
        pupils: s.pupilsOnRoll,
        activeConcerns: s.activeConcerns,
        awaitingDecision: s.awaitingDecision,
      })),
      governanceNote:
        "This report summarises the trust's live safeguarding position for the reporting period. Sentinel Watch surfaces and explains signals; every decision recorded here was made by a designated safeguarding professional. The system never closes a case or auto-actions any concern about a child.",
      methodology:
        "Figures are computed from live data across every school, read each through its own tenancy. Counts reflect active concerns at the moment of generation. Every read and decision against a child's record is written to an append-only audit log.",
      filenameBase: "termly-governance-report",
      text,
    };
  } else {
    const schoolId = tenancy.schools[0]!.id;
    const data = await api.overview.school({ schoolId });
    const text = buildSchoolTermlyReport({
      schoolName: data.school.name,
      generatedOn: now,
      pupilsOnRoll: data.metrics.pupilsOnRoll,
      activeConcerns: data.metrics.activeConcerns,
      awaitingDecision: data.metrics.awaitingDecision,
      reviewed: data.metrics.reviewed,
    });
    report = {
      title: "Termly safeguarding report",
      scopeName: data.school.name,
      period,
      generatedOn,
      metrics: [
        { label: "Pupils on roll", value: n(data.metrics.pupilsOnRoll) },
        { label: "Active concerns", value: n(data.metrics.activeConcerns) },
        { label: "Awaiting decision", value: n(data.metrics.awaitingDecision) },
        { label: "Reviewed this term", value: n(data.metrics.reviewed) },
      ],
      schools: [],
      governanceNote:
        "This report summarises the school's live safeguarding position for the reporting period. Sentinel Watch surfaces and explains signals; every decision recorded here was made by the DSL or a deputy. The system never closes a case or auto-actions any concern about a child.",
      methodology:
        "Figures are computed from the school's live data. Counts reflect active concerns at the moment of generation. Every read and decision against a child's record is written to an append-only audit log.",
      filenameBase: "termly-safeguarding-report",
      text,
    };
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
      <p className="mt-1 text-base text-muted-foreground">
        Generate board-ready safeguarding reports from the trust&apos;s live
        data.
      </p>

      <Card className="mt-6 max-w-2xl p-5">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cobalt-tint text-cobalt">
            <FileBarChart className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-[650]">{report.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{period}</span>
              <span aria-hidden>·</span>
              <span>Generated {generatedOn}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A termly summary of the safeguarding picture: pupils on roll,
              active concerns and what is awaiting a decision, with a
              school-level breakdown for governors and trustees.
            </p>
            <div className="mt-4">
              <ReportDrawer report={report} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
