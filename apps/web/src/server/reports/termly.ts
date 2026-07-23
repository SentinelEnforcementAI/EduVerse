// Termly governance report (spec 5.17 / panel). Deterministic text built from
// the real computed figures — no LLM, no invented numbers. UK English, and no
// em dashes (spec principle 6). This is the deterministic layer; the advisory
// LLM narrative layer (build order step 15) will sit on top of it, never
// replace it.

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export type TrustReportInput = {
  trustName: string;
  generatedOn: Date;
  pupilsOnRoll: number;
  activeConcerns: number;
  awaitingDecision: number;
  schools: {
    name: string;
    pupilsOnRoll: number;
    activeConcerns: number;
    awaitingDecision: number;
  }[];
};

export function buildTrustTermlyReport(input: TrustReportInput): string {
  const schoolLines = input.schools
    .map(
      (s) =>
        `- ${s.name}: ${s.pupilsOnRoll} pupils on roll, ${s.activeConcerns} active concerns, ${s.awaitingDecision} awaiting a decision`,
    )
    .join("\n");

  return `TERMLY SAFEGUARDING REPORT
${input.trustName}
Prepared by Sentinel Watch on ${formatDate(input.generatedOn)} for the Trust Board

OVERVIEW
- Schools in the trust: ${input.schools.length}
- Pupils on roll across the trust: ${input.pupilsOnRoll}
- Active concerns across the trust: ${input.activeConcerns}
- Concerns awaiting a DSL decision: ${input.awaitingDecision}

BY SCHOOL
${schoolLines}

NOTE ON THIS REPORT
These figures are computed from the trust's own data. Pupil identity stays
sealed until a case crosses the action threshold, at which point a reveal is
recorded with a reason. Sentinel Watch surfaces and prepares; every decision
about a child is taken by a person.`;
}

export type SchoolReportInput = {
  schoolName: string;
  generatedOn: Date;
  pupilsOnRoll: number;
  activeConcerns: number;
  awaitingDecision: number;
  reviewed: number;
};

export function buildSchoolTermlyReport(input: SchoolReportInput): string {
  return `TERMLY SAFEGUARDING REPORT
${input.schoolName}
Prepared by Sentinel Watch on ${formatDate(input.generatedOn)} for the governing body

OVERVIEW
- Pupils on roll: ${input.pupilsOnRoll}
- Active concerns: ${input.activeConcerns}
- Concerns awaiting a DSL decision: ${input.awaitingDecision}
- Concerns reviewed and recorded this term: ${input.reviewed}

NOTE ON THIS REPORT
These figures are computed from the school's own data. Pupil identity stays
sealed until a case crosses the action threshold, at which point a reveal is
recorded with a reason. Sentinel Watch surfaces and prepares; every decision
about a child is taken by a person.`;
}
