import type { Prisma } from "@prisma/client";

import { systemDb } from "../src";

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
    senStatus: null,
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

// A filed case document for each hero, so the case view's "Linked documents"
// section is populated in the demo. Sealed by construction: the content carries
// the sealed reference ("the pupil"), never a name. UK English, no em dashes.
const HERO_DOC: Record<
  string,
  { title: string; type: string; status: string; themes: string[]; summary: string; content: string }
> = {
  "hero-online-disclosure": {
    title: "Referral to Children's Social Care (MASH)",
    type: "Referral",
    status: "Filed",
    themes: ["referral", "online safety", "child sexual exploitation", "mash"],
    summary:
      "Same-day referral to the multi-agency safeguarding hub following an online exploitation disclosure.",
    content: `REFERRAL TO CHILDREN'S SOCIAL CARE (MASH)

This referral concerns the pupil identified by the sealed reference on this case. It is made the same day the disclosure was recorded.

The pupil disclosed that an unknown adult contacted them online and asked them to share images. This followed a period of withdrawn presentation and secretive use of a device noted by staff. The concern meets the threshold for an immediate referral under the online child sexual abuse and exploitation guidance.

Consent to refer was considered and the referral proceeds on the basis that seeking consent would place the child at risk. The Designated Safeguarding Lead has preserved the record and awaits acknowledgement from the multi-agency safeguarding hub.`,
  },
  "hero-attendance-behaviour": {
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
  "hero-welfare": {
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
    select: { id: true },
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

    // File the hero's linked case document (idempotent, deterministic id), so
    // the case view's "Linked documents" section is populated. Linked to both
    // the case (signalId) and the pupil (pupilId); sealed by construction.
    const doc = HERO_DOC[hero.key];
    if (doc) {
      const docId = `seed-case-${tenantId.slice(-8)}-${hero.key}`;
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
        },
        create: {
          id: docId,
          tenantId,
          scope: "CASE",
          signalId,
          pupilId,
          title: doc.title,
          type: doc.type,
          docDate: new Date(hero.windowEnd),
          status: doc.status,
          themes: doc.themes,
          summary: doc.summary,
          content: doc.content,
          source: "seed-case",
        },
      });
    }
  }
  return created;
}
