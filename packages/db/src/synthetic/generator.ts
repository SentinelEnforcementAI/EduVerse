// Synthetic pupil data generator.
//
// Fully deterministic: the same (seed, config) always produces the same
// dataset, and each pupil's stream is derived from (school seed, pupil
// index), so pupils can be generated independently in chunks. Risk patterns
// are embedded deliberately so the rules engine (build step 5) has known
// ground truth to detect; the seed run reports which pupils carry which
// pattern.
//
// All data here is invented. No real pupil data may ever enter development —
// see CLAUDE.md data rules.

export type RiskPattern =
  | "attendance-drop"
  | "behaviour-spike"
  | "attainment-decline"
  | "cross-domain"
  | "sustained-absence";

export type GeneratedAttendance = {
  date: Date;
  session: "AM" | "PM";
  code: string;
  present: boolean;
  authorised: boolean;
};

export type GeneratedBehaviour = {
  date: Date;
  category: string;
  severity: number;
  description: string;
};

export type GeneratedAttainment = {
  subject: string;
  assessedAt: Date;
  score: number;
};

// Statutory vulnerability markers + personal snapshot a DSL reads alongside a
// case. In production these come from the MIS via Wonde; here they are drawn
// from a separate deterministic stream so the attendance/behaviour/attainment
// series (and therefore which signals fire) are completely unaffected.
export type PupilProfile = {
  preferredName: string | null;
  sex: string | null;
  admissionDate: Date;
  house: string;
  firstLanguage: string;
  ethnicity: string;
  pupilPremium: boolean;
  freeSchoolMeals: boolean;
  senStatus: string | null;
  eal: boolean;
  lookedAfter: boolean;
  youngCarer: boolean;
  serviceChild: boolean;
  medicalNeeds: string | null;
};

export type GeneratedPupil = {
  upn: string;
  firstName: string;
  lastName: string;
  yearGroup: number;
  registrationGroup: string;
  dateOfBirth: Date;
  riskPattern: RiskPattern | null;
  attendance: GeneratedAttendance[];
  behaviour: GeneratedBehaviour[];
  attainment: GeneratedAttainment[];
} & PupilProfile;

export type SchoolConfig = {
  schoolSlug: string;
  seed: number;
  pupilCount: number;
  months: number;
  anchorDate: Date;
};

// Proportions per school roll, matching the design brief (~800 pupils).
// Roughly even across the five patterns so the active concerns show a genuine
// mix rather than a wall of attendance flags — and the flagship cross-domain
// "joins the dots" pattern is well-represented, not a rarity. (Was heavily
// weighted to attendance-drop, which skewed every demo overview.)
const PATTERN_RATES: [RiskPattern, number][] = [
  ["attendance-drop", 12 / 800],
  ["behaviour-spike", 12 / 800],
  ["attainment-decline", 11 / 800],
  ["cross-domain", 10 / 800],
  ["sustained-absence", 10 / 800],
];

const FIRST_NAMES = [
  "Oliver", "Amelia", "George", "Isla", "Noah", "Ava", "Arthur", "Ivy",
  "Muhammad", "Freya", "Leo", "Lily", "Harry", "Florence", "Oscar", "Mia",
  "Archie", "Willow", "Henry", "Rosie", "Theodore", "Sophia", "Freddie",
  "Grace", "Charlie", "Daisy", "Jack", "Sienna", "Alfie", "Poppy", "Jacob",
  "Elsie", "Thomas", "Emily", "Finley", "Evie", "Arlo", "Maya", "Theo",
  "Phoebe", "William", "Ella", "Luca", "Harper", "Joshua", "Millie", "James",
  "Erin", "Reuben", "Aisha", "Ethan", "Zara", "Adam", "Nancy", "Kian",
  "Robyn", "Dylan", "Esme", "Samuel", "Eliza",
];

const LAST_NAMES = [
  "Smith", "Jones", "Williams", "Taylor", "Brown", "Davies", "Evans",
  "Wilson", "Thomas", "Roberts", "Johnson", "Lewis", "Walker", "Robinson",
  "Wood", "Thompson", "White", "Watson", "Jackson", "Wright", "Green",
  "Harris", "Cooper", "King", "Lee", "Martin", "Clarke", "James", "Morgan",
  "Hughes", "Edwards", "Hill", "Moore", "Clark", "Harrison", "Scott",
  "Young", "Morris", "Hall", "Ward", "Turner", "Carter", "Phillips",
  "Mitchell", "Patel", "Adams", "Campbell", "Anderson", "Allen", "Cook",
  "Bailey", "Parker", "Miller", "Davis", "Murphy", "Price", "Bell", "Baker",
  "Griffiths", "Kelly",
];

const BEHAVIOUR_CATEGORIES: Record<string, string[]> = {
  disruption: [
    "Repeatedly talking over the teacher in lesson",
    "Disrupting the learning of others",
    "Refusing to settle to work after warnings",
  ],
  defiance: [
    "Refused a reasonable instruction",
    "Walked out of lesson without permission",
    "Refused to hand over a mobile phone",
  ],
  verbal: [
    "Verbal altercation with another pupil",
    "Inappropriate language towards staff",
    "Name-calling towards a peer",
  ],
  physical: [
    "Physical altercation at break time",
    "Pushing another pupil in the corridor",
  ],
  other: [
    "Late to lesson without explanation",
    "Uniform breach after repeated reminders",
  ],
};

const SUBJECTS = ["English", "Maths", "Science"];

const HOUSES = ["Rivers", "Downs", "Weald", "Cliff"];
// A short, representative spread. Weighted towards "White British" to mirror a
// typical South-East England intake, with a realistic tail.
const ETHNICITIES = [
  "White British", "White British", "White British", "White British",
  "White Other", "Asian British — Indian", "Asian British — Pakistani",
  "Black British — African", "Mixed — White and Black Caribbean",
  "Any other ethnic group",
];
const EAL_LANGUAGES = [
  "Polish", "Urdu", "Romanian", "Portuguese", "Bengali", "Arabic", "Panjabi",
];
const MEDICAL_LABELS = [
  "Asthma", "Type 1 diabetes", "Epilepsy", "Severe nut allergy",
  "ADHD (medicated)", "Anaphylaxis — EpiPen",
];

// Draw a pupil's statutory-context markers and personal snapshot from a
// dedicated deterministic stream. Rates approximate England national figures so
// the caseload context reads true; the exact numbers are not the point.
function generateProfile(
  config: SchoolConfig,
  index: number,
  yearGroup: number,
): PupilProfile {
  // A distinct constant keeps this stream independent of the event-data rng, so
  // adding these fields never shifts attendance/behaviour/attainment.
  const rng = createRng(config.seed * 100_003 + index * 7 + 99_991);

  const freeSchoolMeals = rng() < 0.23;
  // Pupil Premium is the wider eligibility (ever-6 FSM + LAC/service); a FSM
  // pupil is always PP, plus a slice of others.
  const pupilPremium = freeSchoolMeals || rng() < 0.06;
  const senRoll = rng();
  const senStatus =
    senRoll < 0.043 ? "EHCP" : senRoll < 0.17 ? "SEN Support" : null;
  const eal = rng() < 0.19;
  const lookedAfter = rng() < 0.008;
  const youngCarer = rng() < 0.015;
  const serviceChild = rng() < 0.008;
  const medicalNeeds = rng() < 0.12 ? pick(rng, MEDICAL_LABELS) : null;

  // Admission: normally September of the pupil's entry year; ~5% are in-year
  // admissions (themselves a recognised vulnerability marker).
  const entryYear = config.anchorDate.getUTCFullYear() - (yearGroup - 7) - 1;
  const inYear = rng() < 0.05;
  const admissionDate = inYear
    ? utcDate(entryYear + 1, Math.floor(rng() * 6), 1 + Math.floor(rng() * 27))
    : utcDate(entryYear, 8, 3); // 3 September

  return {
    // Most pupils go by their given name; a minority have a recorded preferred
    // name. Kept null here (the UI falls back to the first name); hero cases set
    // it explicitly where the story needs it.
    preferredName: null,
    sex: rng() < 0.51 ? "Male" : "Female",
    admissionDate,
    house: pick(rng, HOUSES),
    firstLanguage: eal ? pick(rng, EAL_LANGUAGES) : "English",
    ethnicity: pick(rng, ETHNICITIES),
    pupilPremium,
    freeSchoolMeals,
    senStatus,
    eal,
    lookedAfter,
    youngCarer,
    serviceChild,
    medicalNeeds,
  };
}

// mulberry32 — small, fast, deterministic PRNG.
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function utcDate(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

// All weekdays in the `months` months up to and including the anchor date.
// CTO-DECISION: real term-date calendars per school. Weekdays-only is the
// simplest working version; relative patterns still hold.
export function schoolDays(anchorDate: Date, months: number): Date[] {
  const end = utcDate(
    anchorDate.getUTCFullYear(),
    anchorDate.getUTCMonth(),
    anchorDate.getUTCDate(),
  );
  const start = utcDate(
    end.getUTCFullYear(),
    end.getUTCMonth() - months,
    end.getUTCDate(),
  );
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d);
  }
  return days;
}

export function patternCounts(pupilCount: number): [RiskPattern, number][] {
  return PATTERN_RATES.map(([pattern, rate]) => [
    pattern,
    Math.max(1, Math.round(pupilCount * rate)),
  ]);
}

// Pattern for a pupil index: the first pupils carry the embedded patterns,
// deterministically. Names, groups and everything else are random per pupil,
// so this ordering is invisible in the data itself.
export function patternForIndex(
  index: number,
  pupilCount: number,
): RiskPattern | null {
  let offset = 0;
  for (const [pattern, count] of patternCounts(pupilCount)) {
    if (index < offset + count) return pattern;
    offset += count;
  }
  return null;
}

type AbsenceProfile = {
  // Probability a given school day is an absence day.
  base: number;
  // Probability override for the recent window.
  recent: number;
  recentDays: number;
  // Weekday (1–5) that is habitually missed, for sustained-absence.
  habitualWeekday: number | null;
  habitualRate: number;
};

function absenceProfile(
  pattern: RiskPattern | null,
  rng: () => number,
): AbsenceProfile {
  const base = 0.02 + rng() * 0.05;
  switch (pattern) {
    case "attendance-drop":
      return {
        base,
        recent: 0.35 + rng() * 0.1,
        recentDays: 40,
        habitualWeekday: null,
        habitualRate: 0,
      };
    case "cross-domain":
      return {
        base,
        recent: 0.15 + rng() * 0.05,
        recentDays: 40,
        habitualWeekday: null,
        habitualRate: 0,
      };
    case "sustained-absence":
      return {
        base,
        recent: base,
        recentDays: 0,
        habitualWeekday: 1 + Math.floor(rng() * 5),
        // High enough that the pattern is visible in any 12-week window,
        // matching the "misses every Monday" archetype this pattern embeds.
        habitualRate: 0.85,
      };
    default:
      return {
        base,
        recent: base,
        recentDays: 0,
        habitualWeekday: null,
        habitualRate: 0,
      };
  }
}

function generateAttendance(
  days: Date[],
  profile: AbsenceProfile,
  rng: () => number,
): GeneratedAttendance[] {
  const records: GeneratedAttendance[] = [];
  const recentStart = days.length - profile.recentDays;

  days.forEach((date, i) => {
    let pAbsent = i >= recentStart ? profile.recent : profile.base;
    if (profile.habitualWeekday !== null && date.getUTCDay() === profile.habitualWeekday) {
      pAbsent = profile.habitualRate;
    }

    const absentToday = rng() < pAbsent;
    // Unauthorised absence dominates in the deteriorating window.
    const unauthorised = absentToday && rng() < (i >= recentStart && profile.recentDays > 0 ? 0.6 : 0.3);
    const absenceCode = unauthorised ? (rng() < 0.5 ? "O" : "N") : pick(rng, ["I", "I", "M", "C"]);
    // Most absence days lose both sessions; some are half-days.
    const pmAlsoAbsent = rng() < 0.85;

    for (const session of ["AM", "PM"] as const) {
      const absent = absentToday && (session === "AM" || pmAlsoAbsent);
      if (absent) {
        records.push({ date, session, code: absenceCode, present: false, authorised: !unauthorised });
      } else {
        const late = session === "AM" && rng() < 0.03;
        records.push({ date, session, code: late ? "L" : "/", present: true, authorised: true });
      }
    }
  });
  return records;
}

function generateBehaviour(
  days: Date[],
  pattern: RiskPattern | null,
  rng: () => number,
): GeneratedBehaviour[] {
  const incidents: GeneratedBehaviour[] = [];
  const categories = Object.keys(BEHAVIOUR_CATEGORIES);

  const addIncident = (date: Date, severityBoost: boolean) => {
    const category = pick(rng, categories);
    const r = rng();
    const severity = severityBoost
      ? r < 0.35 ? 3 : r < 0.8 ? 2 : 1
      : r < 0.03 ? 3 : r < 0.2 ? 2 : 1;
    incidents.push({
      date,
      category,
      severity,
      description: pick(rng, BEHAVIOUR_CATEGORIES[category]!),
    });
  };

  // Baseline: most pupils have 0–3 incidents across the whole period.
  const r = rng();
  const baselineCount = r < 0.55 ? 0 : r < 0.8 ? 1 : r < 0.93 ? 2 : 3;
  for (let i = 0; i < baselineCount; i++) addIncident(pick(rng, days), false);

  // Spike: a cluster of incidents in the final six school weeks.
  if (pattern === "behaviour-spike" || pattern === "cross-domain") {
    const recentDays = days.slice(-30);
    const spikeCount =
      pattern === "behaviour-spike"
        ? 6 + Math.floor(rng() * 4)
        : 3 + Math.floor(rng() * 2);
    for (let i = 0; i < spikeCount; i++) addIncident(pick(rng, recentDays), true);
  }

  incidents.sort((a, b) => a.date.getTime() - b.date.getTime());
  return incidents;
}

function generateAttainment(
  days: Date[],
  pattern: RiskPattern | null,
  rng: () => number,
): GeneratedAttainment[] {
  // Assessment points roughly termly: every ~13 school weeks.
  const points: Date[] = [];
  const step = 65;
  for (let i = days.length - 1; i >= 0; i -= step) points.unshift(days[i]!);

  const records: GeneratedAttainment[] = [];
  for (const subject of SUBJECTS) {
    const ability = 45 + rng() * 40;
    const declinePerPoint =
      pattern === "attainment-decline"
        ? 4 + rng() * 3
        : pattern === "cross-domain"
          ? 2.5 + rng() * 1.5
          : 0;
    points.forEach((assessedAt, i) => {
      const drift = declinePerPoint * i;
      const noise = (rng() - 0.5) * 8;
      const score = Math.round(
        Math.min(100, Math.max(0, ability - drift + noise)),
      );
      records.push({ subject, assessedAt, score });
    });
  }
  return records;
}

export function generatePupil(
  config: SchoolConfig,
  index: number,
): GeneratedPupil {
  // Per-pupil stream: chunk-independent and fully deterministic.
  const rng = createRng(config.seed * 100_003 + index * 7 + 1);
  const pattern = patternForIndex(index, config.pupilCount);
  const days = schoolDays(config.anchorDate, config.months);

  const yearGroup = 7 + (index % 5);
  const registrationGroup = `${yearGroup}${pick(rng, ["A", "B", "C", "D"])}`;
  const birthYear = config.anchorDate.getUTCFullYear() - (yearGroup + 5);
  const dateOfBirth = utcDate(
    birthYear,
    Math.floor(rng() * 12),
    1 + Math.floor(rng() * 28),
  );

  return {
    upn: `SW-${config.schoolSlug.toUpperCase().slice(0, 3)}-${String(index + 1).padStart(4, "0")}`,
    firstName: pick(rng, FIRST_NAMES),
    lastName: pick(rng, LAST_NAMES),
    yearGroup,
    registrationGroup,
    dateOfBirth,
    riskPattern: pattern,
    attendance: generateAttendance(days, absenceProfile(pattern, rng), rng),
    behaviour: generateBehaviour(days, pattern, rng),
    attainment: generateAttainment(days, pattern, rng),
    ...generateProfile(config, index, yearGroup),
  };
}

export function generateSchool(config: SchoolConfig): GeneratedPupil[] {
  return Array.from({ length: config.pupilCount }, (_, i) =>
    generatePupil(config, i),
  );
}
