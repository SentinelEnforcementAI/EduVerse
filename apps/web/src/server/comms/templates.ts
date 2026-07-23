// Comms drafting (spec 5.6). Eight document types, each with a deterministic
// draft built from real case data. This is the fallback layer that always
// produces a complete, sensible document (spec principle 9); the LLM advisory
// draft (build order step 15) layers on top and falls back to exactly this.
//
// UK English throughout, and no em dashes in any generated document
// (principle 6). The pupil is referred to by the sealed reference unless the
// case has been revealed, in which case the caller passes the revealed name.

export type CommType =
  | "mash"
  | "parent"
  | "senco"
  | "earlyhelp"
  | "wellbeing"
  | "antibully"
  | "attendance"
  | "chronology";

export type CommMeta = {
  type: CommType;
  label: string;
  blurb: string;
  // How the filed document is catalogued in the repository (spec 5.9).
  docTitle: string;
  docType: string;
  themes: string[];
  primary?: boolean;
};

export const COMM_META: Record<CommType, CommMeta> = {
  mash: {
    type: "mash",
    label: "MASH referral",
    blurb: "Statutory referral to children's social care",
    docTitle: "MASH Referral",
    docType: "Referral",
    themes: ["child protection", "mash", "referral"],
    primary: true,
  },
  parent: {
    type: "parent",
    label: "Parent or carer contact",
    blurb: "Warm invitation to talk",
    docTitle: "Letter to Parent",
    docType: "Letter",
    themes: ["family", "communication"],
  },
  senco: {
    type: "senco",
    label: "SENCO consultation",
    blurb: "Internal SEND view",
    docTitle: "SENCO Consultation",
    docType: "Note",
    themes: ["send", "consultation"],
  },
  earlyhelp: {
    type: "earlyhelp",
    label: "Early Help assessment",
    blurb: "Open a coordinated assessment",
    docTitle: "Early Help Assessment",
    docType: "Assessment",
    themes: ["early help", "family", "welfare"],
  },
  wellbeing: {
    type: "wellbeing",
    label: "Wellbeing or counsellor referral",
    blurb: "Internal wellbeing support",
    docTitle: "Wellbeing Referral",
    docType: "Note",
    themes: ["welfare", "wellbeing"],
  },
  antibully: {
    type: "antibully",
    label: "Anti-bullying record",
    blurb: "Log under the bullying procedure",
    docTitle: "Anti-Bullying Record",
    docType: "Record",
    themes: ["bullying", "child on child", "behaviour"],
  },
  attendance: {
    type: "attendance",
    label: "Attendance support letter",
    blurb: "Parental attendance contact",
    docTitle: "Attendance Letter",
    docType: "Letter",
    themes: ["attendance", "welfare"],
  },
  chronology: {
    type: "chronology",
    label: "Chronology export",
    blurb: "Full signal chronology",
    docTitle: "Safeguarding Chronology",
    docType: "Chronology",
    themes: ["chronology", "welfare", "timeline"],
  },
};

export const COMM_TYPES = Object.keys(COMM_META) as CommType[];

export type CaseDraftData = {
  schoolName: string;
  pupilRef: string;
  yearGroup: number;
  window: string;
  dsl: string;
  date: string;
  confidence: string;
  timeline: { date: string | null; label: string; source: string }[];
  overall: string;
};

function chronology(data: CaseDraftData): string {
  return data.timeline
    .map((t) => `- ${t.date ?? "date unknown"}: ${t.label} (source: ${t.source})`)
    .join("\n");
}

// Builds the deterministic draft for a comm type. Every branch returns a
// complete document; there is no path that returns an empty string.
export function buildDraft(type: CommType, data: CaseDraftData): string {
  const chrono = chronology(data);
  const pupil = `${data.pupilRef} (Year ${data.yearGroup})`;

  switch (type) {
    case "mash":
      return `MULTI-AGENCY SAFEGUARDING HUB (MASH) REFERRAL

School: ${data.schoolName}
Referrer: ${data.dsl}, Designated Safeguarding Lead
Date of referral: ${data.date}
Pupil reference: ${pupil}

REASON FOR REFERRAL
This referral follows a linked cluster of safeguarding concerns identified over the observation window. The concerns meet the threshold for specialist intervention under the local continuum of need.

CHRONOLOGY OF CONCERNS
${chrono}

CURRENT ASSESSMENT
${data.overall}

ACTION REQUESTED
We request a MASH assessment and a decision on next steps under section 17 and section 47 of the Children Act 1989. The school can provide the full chronology and pastoral records on request. We have considered whether informing the parents would increase risk to the child, and we request MASH guidance before any parental contact is made.

This referral is logged on the school safeguarding system with a full audit trail.`;

    case "parent":
      return `Subject: A quick chat about your child

Dear Parent or Carer,

I am writing as the Designated Safeguarding Lead at ${data.schoolName}. Over the past couple of weeks, staff have noticed some small changes in how your child has seemed at school. Nothing here is a cause for alarm, and I want to stress that. We simply like to check in early when we notice a few things together, rather than wait.

We would value a short, informal conversation to share what we have seen and to hear how things are at home. This is about understanding how best to support your child, not about anything they have done wrong.

Please let the school office know a time that suits you this week. If a call is easier, I am very happy to phone.

With kind regards,
${data.dsl}
Designated Safeguarding Lead, ${data.schoolName}`;

    case "senco":
      return `INTERNAL NOTE: SENCO CONSULTATION REQUEST

Pupil: ${pupil}
Raised by: ${data.dsl}, DSL
Date: ${data.date}

Watch has identified a pattern that may reflect an unmet learning or sensory need. I would value a SENCO view on whether the recent changes are consistent with a SEND need or are more likely pastoral in origin.

Specifically:
- Are any concentration or engagement concerns new or longstanding?
- Would a short period of monitoring against the SEND record be useful?
- Should we align any pastoral review with existing SEND provision?

I have scheduled a pastoral review and will share the outcome with you.`;

    case "earlyhelp":
      return `EARLY HELP ASSESSMENT: OPENING SUMMARY

Pupil: ${pupil}
Lead practitioner: ${data.dsl}, DSL
Date opened: ${data.date}

REASON FOR EARLY HELP
Watch has identified an emerging pattern of need over the assessment window. The concerns sit below the threshold for a statutory referral but warrant a coordinated, school-led response with the family.

SUMMARY OF SIGNALS
${chrono}

INITIAL FOCUS
- Understand the family context behind the recent changes.
- Agree practical support with the parents or carers.
- Set a short review point to check whether the plan is working.

NEXT STEPS
Convene an initial conversation with the family, and consider whether a Team Around the Family is needed. Watch will continue to monitor and will flag any change in the level of need.`;

    case "wellbeing":
      return `INTERNAL NOTE: WELLBEING SUPPORT REFERRAL

Pupil: ${pupil}
Raised by: ${data.dsl}, DSL
Date: ${data.date}

Watch has identified a consistent low mood or wellbeing pattern over the observation window.

I would like to:
- Offer the pupil a session with the school counsellor this week.
- Put a light-touch check-in in place with a trusted member of staff.
- Make contact with the parents or carers to share our support and understand home context.

If the pattern continues to escalate, I will consider a GP conversation or a CAMHS route and will consult with you first.`;

    case "antibully":
      return `ANTI-BULLYING PROCEDURE: INCIDENT RECORD

Pupil: ${pupil}
Recorded by: ${data.dsl}, DSL
Date: ${data.date}

SUMMARY
Watch has surfaced a cluster suggesting peer conflict, with a possible online element and withdrawal from shared spaces.

ACTIONS UNDER PROCEDURE
- Speak with the pupil to understand what has happened and how they feel.
- Apply a restorative approach with the peers involved, handled separately.
- Review any online dimension under the school's online safety policy.
- Make contact with the parents or carers of the pupil affected.

REVIEW
A follow-up check-in will be held within one week to confirm the situation has settled. This record is logged with a full audit trail.`;

    case "attendance":
      return `Subject: Supporting your child's attendance

Dear Parent or Carer,

I am writing from ${data.schoolName} about your child's recent attendance. We have noticed a pattern of lateness and absence over the past few weeks, and we would like to work with you to put the right support in place.

We understand that mornings and home life can be difficult, and there may be circumstances we are not aware of. We would welcome a short meeting this week to talk things through and agree a simple plan together. If there are caring responsibilities or other pressures at home, please do let us know, as we may be able to help.

Please contact the school office to arrange a convenient time.

With kind regards,
${data.dsl}
Designated Safeguarding Lead, ${data.schoolName}`;

    case "chronology":
      return `SAFEGUARDING CHRONOLOGY: ${data.pupilRef}

School: ${data.schoolName}
Year group: Year ${data.yearGroup}
Window: ${data.window}
Prepared by: ${data.dsl}, DSL
Confidence: ${data.confidence}

SIGNAL CHRONOLOGY
${chrono}

WATCH ASSESSMENT
${data.overall}

This chronology is exported from the school safeguarding system and reflects the full audit trail held on file.`;
  }
}
