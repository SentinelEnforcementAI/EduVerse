import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { EscalationLevel } from "@/server/escalation";
import { Card } from "@/components/ui/card";

import { LevelChip } from "./level-chip";

export type TriageRow = {
  id: string;
  schoolId: string;
  schoolName: string;
  ref: string;
  yearGroup: number;
  headline: string;
  level: EscalationLevel;
  confidence: string;
  status: string;
};

// The triage working list (spec 5.4): sealed reference, headline, escalation
// level, confidence, status. Whole row opens the case. Confidence hides below
// 720px (spec section 4). `caseHref` turns a row into its case URL, keeping the
// right school in the path for a director browsing across the trust.
export function TriageList({
  title,
  subtitle,
  rows,
  showSchool,
  caseHref,
}: {
  title: string;
  subtitle: string;
  rows: TriageRow[];
  showSchool: boolean;
  caseHref: (row: TriageRow) => string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>

      {rows.length === 0 ? (
        <Card className="mt-6 p-6 text-base text-muted-foreground">
          No cases meet this filter right now. As the rules engine surfaces
          patterns from ingested data, they appear here for review.
        </Card>
      ) : (
        <ul className="mt-6 overflow-hidden rounded-lg border border-cloud bg-card">
          {rows.map((row) => (
            <li key={row.id} className="border-b border-cloud last:border-b-0">
              <Link
                href={caseHref(row)}
                className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <LevelChip level={row.level} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="font-semibold">{row.ref}</span>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      Year {row.yearGroup}
                    </span>
                    {showSchool ? (
                      <span className="text-sm text-muted-foreground">
                        {row.schoolName}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {row.headline}
                  </div>
                </div>
                <span className="hidden text-sm text-muted-foreground min-[720px]:block">
                  {row.confidence} confidence
                </span>
                <ChevronRight
                  className="size-5 text-muted-foreground"
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
