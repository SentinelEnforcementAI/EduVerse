// Document reading (spec 5.11): Watch reads an inbound document, extracts the
// key fields, and PROPOSES an update. A person applies it. This is the
// deterministic extraction layer that always yields a complete, sensible
// proposal (principle 9); the LLM extraction (step 15) falls back to exactly
// this. Nothing here changes state — proposing and applying are separate steps,
// and only a person applies (principle 1).

export type MashProposal = {
  decision: string;
  nextStep: string;
  rationale: string;
};

// Reads a MASH response and proposes the decision the school should record.
export function parseMashResponse(text: string): MashProposal {
  const t = text.toLowerCase();
  let decision: string;
  let nextStep: string;

  if (/\bno further action\b|\bnfa\b/.test(t)) {
    decision = "No further action by children's social care";
    nextStep = "Continue school-led support and monitor.";
  } else if (/strategy (discussion|meeting)/.test(t)) {
    decision = "Progressing to a strategy discussion";
    nextStep = "Attend the strategy discussion and share the chronology.";
  } else if (/section 47|child protection enquir/.test(t)) {
    decision = "Section 47 enquiry";
    nextStep = "Support the section 47 enquiry and preserve records.";
  } else if (/child and family assessment|section 17|child in need/.test(t)) {
    decision = "Child and Family Assessment (section 17)";
    nextStep = "Contribute to the assessment and attend any meetings.";
  } else if (/early help/.test(t)) {
    decision = "Step down to Early Help";
    nextStep = "Lead an Early Help assessment with the family.";
  } else {
    decision = "Decision recorded, awaiting detail";
    nextStep = "Follow the guidance in the MASH response.";
  }

  // Rationale: the first substantive sentence of the response, or a default.
  const firstSentence = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s/)
    .map((s) => s.trim())
    .find((s) => s.length > 20);
  const rationale = firstSentence
    ? firstSentence.slice(0, 400)
    : "As set out in the MASH response.";

  return { decision, nextStep, rationale };
}

export type TrainingProposal = {
  renews: string;
  course: string;
};

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

// Reads a training certificate and proposes the renewal date to record.
export function parseTrainingCertificate(text: string): TrainingProposal {
  const t = text.toLowerCase();

  // A renewal or expiry date in "Month YYYY" or "DD Month YYYY" form.
  const dateMatch = t.match(
    new RegExp(
      `(?:renew\\w*|expir\\w*|valid until|due)[^0-9a-z]*(?:(\\d{1,2})\\s+)?(${MONTHS.join("|")})\\s+(\\d{4})`,
    ),
  );
  let renews: string;
  if (dateMatch) {
    const month = dateMatch[2]![0]!.toUpperCase() + dateMatch[2]!.slice(1);
    renews = `Renews ${month} ${dateMatch[3]}`;
  } else {
    const yearMatch = t.match(/\b(20\d{2})\b/);
    renews = yearMatch ? `Renews ${yearMatch[1]}` : "Renewal date not stated";
  }

  const course = /designated safeguarding lead|dsl/.test(t)
    ? "DSL training"
    : /safeguarding/.test(t)
      ? "Whole-staff safeguarding training"
      : "Training";

  return { renews, course };
}
