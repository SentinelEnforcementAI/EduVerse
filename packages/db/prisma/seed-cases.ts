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
    dataPoints: {
      date: string;
      label: string;
      src: string;
      recordedBy?: string;
    }[];
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
          label: "Withdrawn and anxious while using phone",
          src: "Pastoral / Watch entry",
          recordedBy: "Pastoral Lead",
        },
        {
          date: "2026-04-25",
          label: "Secretive behaviour and device concealed from staff",
          src: "Behaviour / Bromcom",
          recordedBy: "J. Harris",
        },
        {
          date: "2026-04-27",
          label: "Disclosure that an unknown adult requested images online",
          src: "Pastoral / Watch entry",
          recordedBy: "DSL",
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
      themes: ["attendance", "wellbeing", "behaviour", "sen support", "early help"],
      summary:
        "Early Help assessment completed following a fortnight of linked attendance, wellbeing and behaviour concerns. Existing SEN Support recognised alongside identified protective factors.",
      imageKey: "early-help-assessment",
      content: `BACKGROUND

This assessment has been completed in relation to Pupil 0421 following a review of attendance, emotional wellbeing and behaviour over the previous fortnight.

PRESENTING NEEDS

Attendance has declined with several late arrivals and partial absences. Staff have observed reduced classroom engagement, increased anxiety before lessons and withdrawal from peers during unstructured times. Existing SEN Support remains in place and continues to be implemented consistently.

STRENGTHS AND PROTECTIVE FACTORS

The pupil maintains positive relationships with trusted staff, responds well to predictable routines and engages positively during structured activities. The family remains communicative and supportive of school-based interventions.

ASSESSMENT OF NEED

Each concern is low level when viewed individually. However, the combined presentation suggests an emerging pattern requiring coordinated monitoring and early intervention. At the time of assessment the threshold for statutory intervention had not been met, although safeguarding oversight remained appropriate.

PLAN OF SUPPORT

Continue SEN Support arrangements. Weekly wellbeing conversations with pastoral staff. Daily attendance monitoring. Family liaison maintained. Review in two weeks or sooner should safeguarding concerns escalate.

This assessment forms part of the ongoing record for this case.`,
    },
    {
      key: "0421-family-support-letter",
      title: "Family Support Letter",
      type: "Letter",
      status: "Draft",
      date: "2026-04-25",
      themes: ["family support", "wellbeing", "young carer", "early help"],
      summary:
        "Draft letter offering coordinated support following emerging wellbeing concerns and possible caring responsibilities identified within this case.",
      imageKey: "family-support-letter",
      content: `PRIVATE AND CONFIDENTIAL

Dear Parent or Carer,

We are writing to let you know that members of our pastoral and safeguarding team would like to offer some additional support to your family.

Over recent weeks we have noticed several low-level changes in relation to Pupil 0421, including attendance, emotional wellbeing and engagement in school. While none of these concerns alone would require additional intervention, together they suggest that an early conversation may be beneficial.

We also understand that the pupil may occasionally undertake caring responsibilities at home. We appreciate the pressures many families experience and want to ensure appropriate support is available where required.

We would like to invite you to meet with a member of our pastoral and safeguarding team to discuss how school may be able to support your family. This may include practical advice, coordinated school support or referral to voluntary services where appropriate.

Our aim is to work alongside families in a supportive and respectful way so that pupils can attend school regularly, feel safe and achieve their full potential.

Yours faithfully,

Safeguarding Team
Downlands Secondary School`,
    },
    {
      key: "0421-case-chronology",
      title: "Case Chronology",
      type: "Chronology",
      status: "Filed",
      date: "2026-04-28",
      themes: ["chronology", "attendance", "wellbeing", "safeguarding"],
      summary:
        "Chronological record of safeguarding activity relating to Pupil 0421 up to referral on 28 April 2026.",
      imageKey: "case-chronology",
      content: `CASE REFERENCE

Pupil 0421

CHRONOLOGY

14 April 2026
Attendance monitoring identifies increased late arrivals.

16 April 2026
Tutor records reduced engagement during lessons.

18 April 2026
Pastoral welfare conversation completed. No safeguarding disclosure made.

21 April 2026
SEN Support reviewed. Existing strategies remain appropriate.

23 April 2026
Withdrawal from peers observed during lunchtime.

25 April 2026
Family Support Letter drafted following review of wellbeing indicators.

27 April 2026
Early Help Assessment completed. Coordinated monitoring agreed.

28 April 2026 09:40
Pupil discloses concerning online contact with an unknown adult.

28 April 2026 10:15
DSL reviews chronology and safeguarding history.

28 April 2026 11:20
Threshold met for referral to Children's Social Care.

28 April 2026 12:05
Safeguarding record updated. Ongoing monitoring arrangements confirmed.

This chronology forms the sealed record for this case.`,
    },
    {
      key: "0421-referral-childrens-social-care",
      title: "Referral to Children's Social Care",
      type: "Referral",
      status: "Filed",
      date: "2026-04-28",
      themes: ["online safety", "exploitation", "disclosure", "threshold", "referral"],
      summary:
        "Same-day safeguarding referral following a disclosure by Pupil 0421 indicating possible online exploitation. Referral submitted following DSL assessment. Parental consent considered in line with safeguarding procedures.",
      imageKey: "referral-childrens-social-care",
      content: `PURPOSE

This referral concerns Pupil 0421 and has been completed following a safeguarding disclosure received on 28 April 2026.

REASON FOR REFERRAL

During a welfare conversation with a trusted member of staff, the pupil disclosed repeated online contact from an unknown individual who had encouraged communication outside monitored platforms. The pupil described feeling pressured to continue conversations despite expressing discomfort. The disclosure was considered credible and consistent.

DSL ASSESSMENT

The Designated Safeguarding Lead reviewed the disclosure immediately. Existing safeguarding records identified a recent pattern of attendance concerns, emotional withdrawal and reduced classroom engagement. Taken together, these indicators met the threshold for referral to Children's Social Care.

ACTION TAKEN

The pupil remained supported within school while the referral was completed. A same-day referral was submitted following discussion between the DSL and Deputy DSL. Relevant safeguarding records were attached.

PARENTAL INVOLVEMENT

Parental consent was considered in line with safeguarding procedures. It was determined that immediate referral was necessary in the interests of the pupil's safety. Parents will be informed unless doing so would increase risk or compromise safeguarding activity.

NEXT STEPS

School will continue safeguarding oversight of Pupil 0421 pending advice from Children's Social Care. All subsequent decisions and professional discussions will be recorded within this case.`,
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
