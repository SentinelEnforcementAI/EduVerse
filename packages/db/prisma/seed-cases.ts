import type { Prisma } from "@prisma/client";

import { systemDb } from "../src";
import { CASE_DOC_IMAGES } from "./assets/case-docs/images";

// Hand-crafted "hero" cases for the demo (synthetic, illustrative). These sit
// alongside the rules-engine output and give the case view its most compelling
// examples: a mixed-source timeline, a serious Level 4 disclosure that unlocks
// the reveal and referral flow, and a targeted Level 3 welfare case. All data
// is invented.

type Hero = {
  key: string;
  title: string;
  severity: number;
  serious: boolean;
  windowStart: string;
  windowEnd: string;
  reasoning: {
    summary: string;
    metrics: Record<string, string | number>;
    dataPoints: { date: string; label: string; src: string }[];
  };
};

const HEROES: Hero[] = [
  {
    key: "hero-online-disclosure",
    title: "Online safety disclosure",
    severity: 3,
    serious: true,
    windowStart: "2026-04-23",
    windowEnd: "2026-04-28",
    reasoning: {
      summary:
        "A pupil has disclosed that an unknown adult contacted them online and asked them to share images. Alongside the secretive behaviour and anxiety noted beforehand, this is an online child sexual abuse and exploitation concern that meets the threshold for an immediate referral.",
      metrics: {
        signalsLinked: 3,
        daysToSurface: 5,
        outOfHoursSignals: 2,
      },
      dataPoints: [
        {
          date: "2026-04-23",
          label: "Withdrawn and anxious on phone",
          src: "Pastoral / Watch entry",
        },
        {
          date: "2026-04-25",
          label: "Secretive, hid device from staff",
          src: "Behaviour / Bromcom",
        },
        {
          date: "2026-04-27",
          label: "Disclosed an unknown adult asked for images online",
          src: "Pastoral / Watch entry",
        },
      ],
    },
  },
  {
    key: "hero-attendance-behaviour",
    title: "Attendance and behaviour pattern",
    severity: 2,
    serious: false,
    windowStart: "2026-04-14",
    windowEnd: "2026-04-28",
    reasoning: {
      summary:
        "Individually, each signal is minor. Together, they describe a pupil whose attendance, mood and behaviour have shifted in the same direction over a fortnight. Three of these five signals occurred outside school hours awareness.",
      metrics: {
        signalsLinked: 5,
        daysToSurface: 9,
        domains: 3,
      },
      dataPoints: [
        { date: "2026-04-15", label: "3 missed periods, no explanation", src: "Attendance / SIMS" },
        { date: "2026-04-18", label: "Quieter than usual in form group", src: "Pastoral / Watch entry" },
        { date: "2026-04-22", label: "Two minor incidents in PE", src: "Behaviour / Bromcom" },
        { date: "2026-04-25", label: "Concentration concerns flagged", src: "SEND / Bromcom" },
        { date: "2026-04-27", label: "Mentioned home stress to a TA", src: "Pastoral / Watch entry" },
      ],
    },
  },
  {
    key: "hero-welfare",
    title: "Welfare and presentation pattern",
    severity: 3,
    serious: false,
    windowStart: "2026-04-13",
    windowEnd: "2026-04-27",
    reasoning: {
      summary:
        "A pattern of low level welfare indicators in a young child, including hunger and dressing for the weather, alongside a dip in attendance. These point to possible unmet need at home that warrants a coordinated Early Help response.",
      metrics: {
        signalsLinked: 3,
        daysToSurface: 10,
        attendancePct: 88,
      },
      dataPoints: [
        { date: "2026-04-13", label: "Arrived without a coat in cold weather", src: "Pastoral / Watch entry" },
        { date: "2026-04-20", label: "Asked for a second breakfast", src: "Pastoral / Watch entry" },
        { date: "2026-04-25", label: "Attendance fallen to 88%", src: "Attendance / SIMS" },
      ],
    },
  },
];

// A curated safeguarding-context picture for each hero pupil, so the flags on
// the case reinforce its story (rather than the random synthetic spread): the
// disclosure pupil carries disadvantage; the cross-domain pupil has the SEND +
// ADHD context the "concentration concerns" data point implies; the Early-Help
// welfare pupil is a young carer on free school meals — a classic unmet-need
// picture. Applied on every seed so a reset (which regenerates pupils) restores
// it deterministically.
const HERO_PROFILE: Record<string, Prisma.PupilUpdateInput> = {
  "hero-online-disclosure": {
    pupilPremium: true,
    freeSchoolMeals: true,
    senStatus: "SEN Support",
    youngCarer: true,
    medicalNeeds: null,
  },
  "hero-attendance-behaviour": {
    pupilPremium: true,
    senStatus: "SEN Support",
    medicalNeeds: "ADHD (medicated)",
  },
  "hero-welfare": {
    pupilPremium: true,
    freeSchoolMeals: true,
    youngCarer: true,
  },
};

// Filed case documents for each hero, so the case view's "Linked documents"
// section is populated in the demo. Sealed by construction: content carries a
// sealed reference (never a name). UK English, no em dashes. The flagship
// online-disclosure case carries the full four-document set with styled, sealed
// images (imageKey resolves to a data: URL in CASE_DOC_IMAGES); the sealed text
// alongside each stays the searchable source of record.
type CaseDocSpec = {
  key: string;
  title: string;
  type: string;
  status: string;
  date?: string;
  themes: string[];
  summary: string;
  content: string;
  imageKey?: string;
};

const HERO_DOCS: Record<string, CaseDocSpec[]> = {
  "hero-online-disclosure": [
    {
      key: "0421-early-help-assessment",
      title: "Early Help Assessment - Attendance and Wellbeing",
      type: "Assessment",
      status: "Filed",
      date: "2026-04-27",
      themes: ["early help", "attendance", "wellbeing", "send", "young carer"],
      summary:
        "Early Help assessment for attendance, low mood and behaviour changes recorded over a fortnight. No immediate referral at this stage; case kept under safeguarding oversight.",
      imageKey: "early-help-assessment",
      content: `EARLY HELP ASSESSMENT - ATTENDANCE AND WELLBEING
Downlands Secondary School, Weald Multi-Academy Trust
Document reference EHA-2026-0421 (SEALED)

PUPIL DETAILS (SEALED)
Pupil reference: Pupil 0421
Year group: Year 9
Date of birth: [sealed]
Date of assessment: 27 April 2026
Assessment completed by: Pastoral Lead

REASON FOR ASSESSMENT
Concerns regarding attendance, low mood and changes in behaviour recorded over the last fortnight.

PRESENTING NEEDS
- Attendance has declined over the past two weeks (several late arrivals and partial absences).
- Pupil reports feeling worried and tired before school.
- Reduced engagement in lessons.
- Withdrawal from peers at break and lunchtime.
- Increased need for reassurance from staff.

STRENGTHS AND PROTECTIVE FACTORS
- Positive relationships with key staff.
- Engages well in structured activities and 1:1 support.
- Good response to predictable routines.
- Family remains communicative and willing to engage.
- No previous safeguarding concerns of this nature.

ASSESSMENT OF NEED
Concerns are currently low-level when viewed individually but are beginning to indicate a developing pattern. Early Help support is appropriate at this stage. No immediate safeguarding referral required, however case to remain under safeguarding oversight.

PLAN OF SUPPORT
- Continue SEN Support arrangements and classroom strategies.
- Daily check-in with pastoral staff.
- Weekly wellbeing conversation for the next four weeks.
- Monitor attendance daily and contact home if absence persists.
- Offer family support letter (see draft dated 25 April 2026).

REVIEW ARRANGEMENTS
Review date: 11 May 2026 or earlier if required.
DSL to be informed of any escalation in concerns.

CONSENT
Parental consent for Early Help support obtained: Yes. Date: 27 April 2026.`,
    },
    {
      key: "0421-family-support-letter",
      title: "Family Support Letter",
      type: "Letter",
      status: "Draft",
      date: "2026-04-25",
      themes: ["family support", "early help", "young carer", "attendance"],
      summary:
        "Draft letter inviting the pupil's family to meet the pastoral and safeguarding team to discuss coordinated support.",
      imageKey: "family-support-letter",
      content: `PRIVATE AND CONFIDENTIAL
Downlands Secondary School, Weald Multi-Academy Trust
Letter reference FAM-2026-0421 (DRAFT - SEALED)
25 April 2026

To the Parent/Carer of Pupil 0421 (sealed address)

Dear Parent/Carer,

We are writing to let you know that members of our pastoral and safeguarding team would like to offer some additional support to your family.

Over recent weeks we have noticed a small number of changes in Pupil 0421's attendance, emotional wellbeing and general engagement in school. None of these concerns alone would necessarily require additional intervention, but together they suggest that a conversation may be helpful.

We also understand that Pupil 0421 may sometimes take on caring responsibilities at home. We appreciate that many families manage significant commitments and we want to ensure appropriate support is available where needed.

We would like to invite you to meet with a member of our pastoral and safeguarding team to discuss any support that may benefit your family. This could include practical advice, coordinated school support or referral to voluntary services if appropriate. No decisions will be made without discussing options with you unless there is an immediate safeguarding concern.

Our aim is to work alongside families in a supportive and respectful way so that pupils can attend school regularly, feel safe and achieve their full potential.

Please contact the school office if you would like to arrange a convenient time to meet.

Yours faithfully,
Pastoral Lead
Downlands Secondary School`,
    },
    {
      key: "0421-case-chronology",
      title: "Case Chronology",
      type: "Chronology",
      status: "Filed",
      date: "2026-04-28",
      themes: ["chronology", "safeguarding", "attendance", "wellbeing", "online safety"],
      summary:
        "Dated record of the concerns and actions on this case, from the first attendance note to the same-day referral.",
      imageKey: "case-chronology",
      content: `CASE CHRONOLOGY - PUPIL 0421 (SEALED)
Case reference CHR-2026-0421
Exported: 28/04/2026 12:10

14/04/2026 09:15 | Tutor (Year 9) | Attendance | Increase in late arrivals noted this week.
16/04/2026 11:30 | Subject Teacher | Behaviour/Wellbeing | Pupil quieter than usual, minimal participation.
18/04/2026 14:20 | Pastoral Lead | Wellbeing | Welfare check-in completed. Pupil reports feeling worried and tired. No disclosure.
21/04/2026 10:05 | SENCO | SEN Support | Review of support plan. Strategies to continue.
23/04/2026 12:45 | Pastoral Staff | Behaviour/Wellbeing | Withdrawal from peers at lunchtime observed.
25/04/2026 16:10 | Pastoral Lead | Family Engagement | Draft family support letter prepared.
27/04/2026 15:30 | Pastoral Lead | Assessment | Early Help Assessment completed for attendance and wellbeing.
28/04/2026 09:40 | Pastoral Staff | Safeguarding | Pupil discloses concerning online contact from an unknown individual. Feels pressured.
28/04/2026 10:15 | DSL | Safeguarding | DSL informed. Immediate discussion and initial risk assessment.
28/04/2026 11:20 | DSL | Safeguarding | Decision made to refer to Children's Social Care. Referral submitted online.
28/04/2026 12:05 | DSL | Safeguarding | Safeguarding record updated. Case chronology exported.

This chronology is a record of safeguarding concerns and actions for internal school use. All information is sealed and confidential.`,
    },
    {
      key: "0421-referral-childrens-social-care",
      title: "Referral to Children's Social Care",
      type: "Referral",
      status: "Filed",
      date: "2026-04-28",
      themes: ["referral", "online safety", "child sexual exploitation", "children's social care"],
      summary:
        "Same-day referral to Children's Social Care after an online exploitation disclosure met the threshold for statutory intervention.",
      imageKey: "referral-childrens-social-care",
      content: `REFERRAL TO CHILDREN'S SOCIAL CARE
Downlands Secondary School, Weald Multi-Academy Trust
Referral reference DSC-2026-0421 (SEALED)

Pupil reference: Pupil 0421 (sealed)
Date of referral: 28 April 2026
Time of referral: 11:20
Referral completed by: Designated Safeguarding Lead
School: Downlands Secondary School
Trust: Weald Multi-Academy Trust
Local authority: Wealden County Council
Referral method: Online referral portal
Notification to parents/carers: Parental consent considered in line with safeguarding procedures. Parents to be informed unless doing so would increase risk or compromise any safeguarding activity.

REASON FOR REFERRAL
On 28 April 2026, Pupil 0421 disclosed during a welfare conversation with a trusted member of staff that they have been in contact online with an unknown older individual. The pupil reported that the individual has encouraged ongoing communication outside of monitored platforms and has asked for images and personal information. The pupil stated they felt worried and pressured.

The disclosure was considered credible and consistent. The pupil was emotionally affected but engaged appropriately with support offered.

DETAILS AND CONTEXT
A review of existing records shows a pattern of recent concerns including reduced attendance, low mood, withdrawal from peers and reduced engagement in lessons. An Early Help Assessment was completed on 27 April 2026. At the time of assessment, concerns were emerging but did not meet the threshold for statutory intervention.

Following today's disclosure, the DSL has assessed the information and determined that the threshold for referral to Children's Social Care has been met due to potential risk of significant harm through online exploitation.

ACTIONS TAKEN
- Pupil 0421 spoken to, reassured and supported. Safeguarding explained.
- DSL informed immediately.
- Same-day referral submitted to Children's Social Care.
- Police not contacted at this stage pending advice from Social Care.
- Safeguarding record updated. Case chronology appended.

NEXT STEPS
Await acknowledgement and decision from Children's Social Care. Continue to provide appropriate in-school support and maintain daily monitoring.`,
    },
  ],
  "hero-attendance-behaviour": [
    {
      key: "attendance-behaviour-eha",
      title: "Early Help Assessment - Attendance and Wellbeing",
      type: "Assessment",
      status: "Filed",
      themes: ["early help", "attendance", "wellbeing", "send"],
      summary:
        "Early Help assessment opened after a fortnight of aligned attendance, mood and behaviour signals.",
      content: `EARLY HELP ASSESSMENT

This assessment concerns the pupil identified by the sealed reference on this case.

Over a fortnight, attendance, mood and behaviour shifted in the same direction. Individually each signal was minor; together they describe a pupil whose needs are not currently being met. The pupil has SEN Support in place and a known attention need.

The school will lead a coordinated Early Help response with the family's consent: an attendance support conversation, a check-in with the pastoral lead, and a review at the next pastoral meeting.`,
    },
  ],
  "hero-welfare": [
    {
      key: "welfare-early-help-referral",
      title: "Early Help Referral - Family Support",
      type: "Referral",
      status: "Filed",
      themes: ["early help", "welfare", "young carer", "family support"],
      summary:
        "Early Help referral for coordinated family support following low-level welfare indicators.",
      content: `EARLY HELP REFERRAL - FAMILY SUPPORT

This referral concerns the pupil identified by the sealed reference on this case.

A pattern of low-level welfare indicators has been recorded: arriving without adequate clothing for the weather, hunger in the morning, and a dip in attendance. The pupil has young carer responsibilities at home. These point to unmet need that a coordinated Early Help response can address.

The referral is made with the family's consent and seeks family support alongside the school's own pastoral offer.`,
    },
  ],
};

// Seeds the hero cases into a school. flagship schools get all three (including
// the serious Level 4 disclosure); other schools get the two non-serious cases
// so every school has compelling examples without every school having a Level 4.
export async function seedHeroCases(
  tenantId: string,
  opts: { flagship: boolean },
): Promise<number> {
  const heroes = opts.flagship ? HEROES : HEROES.filter((h) => !h.serious);

  const pupils = await systemDb.pupil.findMany({
    where: { tenantId },
    orderBy: { upn: "asc" },
    take: heroes.length,
    select: { id: true, upn: true },
  });
  if (pupils.length < heroes.length) return 0;

  const ruleVersion = await systemDb.ruleVersion.upsert({
    where: { key_version: { key: "demo-hero", version: 1 } },
    update: {},
    create: {
      key: "demo-hero",
      version: 1,
      name: "Cross-domain pattern",
      description: "Hand-crafted demo case",
      params: {},
    },
  });
  const execution = await systemDb.ruleExecution.create({
    data: { tenantId, status: "SUCCEEDED", asOf: new Date(), finishedAt: new Date() },
  });

  let created = 0;
  for (let i = 0; i < heroes.length; i++) {
    const hero = heroes[i]!;
    const pupilId = pupils[i]!.id;

    // Give the hero pupil its curated safeguarding-context picture (idempotent).
    const profile = HERO_PROFILE[hero.key];
    if (profile) {
      await systemDb.pupil.update({ where: { id: pupilId }, data: profile });
    }

    // The flagship case carries a document set whose sealed reference is
    // "Pupil 0421". The sealed reference is the last four digits of the UPN, so
    // we suffix this pupil's UPN with "-0421" (keeping the school prefix, so the
    // case header and its documents read as the same child). The guard keeps it
    // idempotent, and the suffix preserves sort order so the same pupil is
    // re-selected on a non-wiping re-run.
    if (
      hero.key === "hero-online-disclosure" &&
      !pupils[i]!.upn.endsWith("-0421")
    ) {
      await systemDb.pupil.update({
        where: { id: pupilId },
        data: { upn: `${pupils[i]!.upn}-0421` },
      });
    }

    // Idempotent: one hero of each key per school (keyed by pupil + title).
    const existing = await systemDb.signal.findFirst({
      where: { tenantId, pupilId, title: hero.title },
      select: { id: true },
    });
    const signalId =
      existing?.id ??
      (
        await systemDb.signal.create({
          data: {
            tenantId,
            pupilId,
            ruleVersionId: ruleVersion.id,
            executionId: execution.id,
            status: "OPEN",
            severity: hero.severity,
            serious: hero.serious,
            title: hero.title,
            reasoning: hero.reasoning as unknown as Prisma.InputJsonValue,
            windowStart: new Date(hero.windowStart),
            windowEnd: new Date(hero.windowEnd),
          },
          select: { id: true },
        })
      ).id;
    if (!existing) created++;

    // File the hero's linked case documents (idempotent, deterministic ids), so
    // the case view's "Linked documents" section is populated. Each is linked to
    // both the case (signalId) and the pupil (pupilId); sealed by construction.
    // A document may carry a styled sealed image (imageDataUrl) shown in the
    // reader alongside its searchable text.
    const docs = HERO_DOCS[hero.key] ?? [];
    for (const doc of docs) {
      const docId = `seed-case-${tenantId.slice(-8)}-${doc.key}`;
      const imageDataUrl = doc.imageKey
        ? (CASE_DOC_IMAGES[doc.imageKey] ?? null)
        : null;
      await systemDb.document.upsert({
        where: { id: docId },
        update: {
          signalId,
          pupilId,
          title: doc.title,
          summary: doc.summary,
          content: doc.content,
          themes: doc.themes,
          status: doc.status,
          imageDataUrl,
        },
        create: {
          id: docId,
          tenantId,
          scope: "CASE",
          signalId,
          pupilId,
          title: doc.title,
          type: doc.type,
          docDate: new Date(doc.date ?? hero.windowEnd),
          status: doc.status,
          themes: doc.themes,
          summary: doc.summary,
          content: doc.content,
          imageDataUrl,
          source: "seed-case",
        },
      });
    }
  }
  return created;
}
