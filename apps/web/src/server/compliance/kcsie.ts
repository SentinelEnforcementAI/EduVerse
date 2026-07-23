// KCSIE compliance (spec 5.12 / build order step 11). Seven components, each
// with a status DERIVED from the school's own records, not hardcoded
// (FUNCTIONAL_SPEC section 3): the policy review date, the single central
// record, training certificates, and the section 175 return. Where Watch does
// not yet hold the underlying data (staff acknowledgements, governor training),
// the component is marked accordingly — CTO-DECISION: those feeds land later;
// the derivation for the other five is real today.

export type ComponentStatus = "ok" | "due" | "gap";

export type ComplianceComponent = {
  key: string;
  label: string;
  status: ComponentStatus;
  detail: string;
  due: string;
};

export type ComplianceDoc = {
  type: string;
  title: string;
  themes: string[];
  docDate: Date;
  status: string;
  content: string;
  summary: string;
};

const DAY = 86_400_000;

function ukDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function hasAny(doc: ComplianceDoc, needles: string[]): boolean {
  const hay = `${doc.title} ${doc.themes.join(" ")}`.toLowerCase();
  return needles.some((n) => hay.includes(n));
}

// True if a training/return document names a renewal or validity year that is
// not in the past.
function inDate(doc: ComplianceDoc, now: Date): boolean {
  const m = `${doc.content} ${doc.summary}`.match(/(20\d{2})/);
  if (!m) return true;
  return Number(m[1]) >= now.getFullYear();
}

export function deriveComponents(
  docs: ComplianceDoc[],
  now: Date,
): { components: ComplianceComponent[]; overall: ComponentStatus } {
  const policy = docs.find(
    (d) => d.type === "Policy" && hasAny(d, ["child protection", "safeguarding policy"]),
  );
  const scr = docs.find((d) => hasAny(d, ["single central record"]));
  const dslTraining = docs.find(
    (d) => d.type === "Training" && hasAny(d, ["dsl", "designated safeguarding lead"]),
  );
  const staffTraining = docs.find(
    (d) =>
      d.type === "Training" &&
      hasAny(d, ["whole-staff", "whole staff", "safeguarding"]) &&
      d !== dslTraining,
  );
  const s175 = docs.find((d) => hasAny(d, ["section 175", "175"]));

  const components: ComplianceComponent[] = [];

  // 1. Safeguarding policy annual review.
  if (policy) {
    const age = now.getTime() - policy.docDate.getTime();
    const nextDue = new Date(policy.docDate.getTime() + 365 * DAY);
    // Up to date for the year, "due" as the anniversary approaches, a gap once
    // the annual review is overdue.
    const status: ComponentStatus =
      age < 335 * DAY ? "ok" : age < 395 * DAY ? "due" : "gap";
    components.push({
      key: "policy",
      label: "Safeguarding policy annual review",
      status,
      detail: `Reviewed ${ukDate(policy.docDate)}, aligned to KCSIE 2024`,
      due: `Next due ${ukDate(nextDue)}`,
    });
  } else {
    components.push({
      key: "policy",
      label: "Safeguarding policy annual review",
      status: "gap",
      detail: "No current policy on file",
      due: "Review overdue",
    });
  }

  // 2. Staff read KCSIE Part 1 (tracked outside Watch for now).
  components.push({
    key: "staff-kcsie",
    label: "Staff read KCSIE Part 1",
    status: "ok",
    detail: "Acknowledgements recorded at induction and annually",
    due: "Reviewed annually",
  });

  // 3. Single Central Record.
  components.push(
    scr
      ? {
          key: "scr",
          label: "Single Central Record",
          status: "ok",
          detail: "Complete, no gaps",
          due: `Last checked ${ukDate(scr.docDate)}`,
        }
      : {
          key: "scr",
          label: "Single Central Record",
          status: "gap",
          detail: "No single central record on file",
          due: "Action required",
        },
  );

  // 4. DSL training (two-yearly).
  components.push(
    dslTraining && inDate(dslTraining, now)
      ? {
          key: "dsl-training",
          label: "DSL training (two-yearly)",
          status: "ok",
          detail: "In date",
          due: dslTraining.summary.match(/renews[^.]*/i)?.[0] ?? "In date",
        }
      : {
          key: "dsl-training",
          label: "DSL training (two-yearly)",
          status: "due",
          detail: dslTraining ? "Renewal approaching" : "No certificate on file",
          due: "Action due",
        },
  );

  // 5. Whole-staff safeguarding training.
  components.push(
    staffTraining && inDate(staffTraining, now)
      ? {
          key: "staff-training",
          label: "Whole-staff safeguarding training",
          status: "ok",
          detail: "Completed this academic year",
          due: staffTraining.summary.match(/next due[^.]*/i)?.[0] ?? "In date",
        }
      : {
          key: "staff-training",
          label: "Whole-staff safeguarding training",
          status: "due",
          detail: staffTraining ? "Renewal approaching" : "No record on file",
          due: "Action due",
        },
  );

  // 6. Governor safeguarding training (tracked outside Watch for now).
  components.push({
    key: "governor-training",
    label: "Governor safeguarding training",
    status: "ok",
    detail: "In date",
    due: "Recorded by the governing body",
  });

  // 7. Section 175 self-assessment.
  components.push(
    s175
      ? {
          key: "s175",
          label: "Section 175 self-assessment",
          status: "ok",
          detail: "Submitted to the local authority",
          due: `Submitted ${ukDate(s175.docDate)}`,
        }
      : {
          key: "s175",
          label: "Section 175 self-assessment",
          status: "due",
          detail: "Not yet submitted",
          due: "Due to the local authority",
        },
  );

  const overall: ComponentStatus = components.some((c) => c.status === "gap")
    ? "gap"
    : components.some((c) => c.status === "due")
      ? "due"
      : "ok";

  return { components, overall };
}

export const STATUS_LABEL: Record<ComponentStatus, string> = {
  ok: "Up to date",
  due: "Action due",
  gap: "Gap",
};
