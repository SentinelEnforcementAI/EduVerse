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
    // Idempotent: one hero of each key per school (keyed by pupil + title).
    const existing = await systemDb.signal.findFirst({
      where: { tenantId, pupilId, title: hero.title },
      select: { id: true },
    });
    if (existing) continue;

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
    });
    created++;
  }
  return created;
}
