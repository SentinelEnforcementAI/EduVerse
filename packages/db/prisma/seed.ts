import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { systemDb } from "../src";
import {
  generatePupil,
  patternCounts,
  type RiskPattern,
  type SchoolConfig,
} from "../src/synthetic/generator";

// Seeds the two design-partner schools with synthetic pupils and 12 months
// of attendance / behaviour / attainment, including deliberately embedded
// risk patterns for the rules engine to find (build step 5).
//
// Idempotent: re-running wipes and regenerates the synthetic pupil data for
// these two schools only. All data is invented — no real pupil data, ever.

export type SeedOptions = {
  pupilsPerSchool?: number;
  months?: number;
  anchorDate?: Date;
  log?: (message: string) => void;
};

export type SeedSummary = {
  trust: { slug: string; name: string; trustId: string; director: string };
  schools: {
    slug: string;
    name: string;
    tenantId: string;
    pupils: number;
    attendanceRecords: number;
    behaviourIncidents: number;
    attainmentRecords: number;
    riskPupils: Record<RiskPattern, string[]>;
  }[];
};

// All names here are synthetic. The two design-partner schools (Downlands,
// Patcham, per CLAUDE.md) are grouped under one Multi-Academy Trust so both
// tenancy modes — single school and MAT — have real data behind them. The
// trust name is invented for the demo; it is not a real organisation.
const TRUST = { slug: "weald-learning-trust", name: "Weald Learning Trust" };
const DIRECTOR = {
  email: "director@weald-learning-trust.example",
  name: "Trust Director of Safeguarding",
};

const SCHOOLS = [
  { slug: "downlands", name: "Downlands", seed: 1001 },
  { slug: "patcham", name: "Patcham", seed: 2002 },
];

const CHUNK = 100;

export async function seedDatabase(options: SeedOptions = {}): Promise<SeedSummary> {
  const pupilsPerSchool = options.pupilsPerSchool ?? 800;
  const months = options.months ?? 12;
  const anchorDate = options.anchorDate ?? new Date();
  const log = options.log ?? (() => undefined);

  // The Multi-Academy Trust both schools belong to. A trust carries no pupil
  // data itself — every child stays under a school (tenant) — so the MAT
  // reframe leaves per-school row-level security untouched.
  const trust = await systemDb.trust.upsert({
    where: { slug: TRUST.slug },
    update: { name: TRUST.name },
    create: { name: TRUST.name, slug: TRUST.slug },
  });

  // Trust Director of Safeguarding: sees across every school in the trust
  // (spec 5.1). Scoped by trustId, no single tenant.
  await systemDb.user.upsert({
    where: { email: DIRECTOR.email },
    update: { role: "DIRECTOR", trustId: trust.id, tenantId: null },
    create: {
      email: DIRECTOR.email,
      name: DIRECTOR.name,
      role: "DIRECTOR",
      trustId: trust.id,
    },
  });

  const summary: SeedSummary = {
    trust: {
      slug: TRUST.slug,
      name: TRUST.name,
      trustId: trust.id,
      director: DIRECTOR.email,
    },
    schools: [],
  };

  for (const school of SCHOOLS) {
    const tenant = await systemDb.tenant.upsert({
      where: { slug: school.slug },
      update: { name: school.name, trustId: trust.id },
      create: { name: school.name, slug: school.slug, trustId: trust.id },
    });

    // Dev DSL account per school so the school view is usable immediately,
    // plus a couple of colleagues so notes can tag someone. All roles are DSL
    // for the MVP (see the User role CTO-DECISION); the names distinguish them.
    const staff = [
      { email: `dsl@${school.slug}.example`, name: `${school.name} DSL` },
      {
        email: `ddsl@${school.slug}.example`,
        name: `${school.name} Deputy DSL`,
      },
      {
        email: `pastoral@${school.slug}.example`,
        name: `${school.name} Pastoral Lead`,
      },
    ];
    for (const member of staff) {
      await systemDb.user.upsert({
        where: { email: member.email },
        update: { role: "DSL", tenantId: tenant.id, trustId: null },
        create: {
          email: member.email,
          name: member.name,
          role: "DSL",
          tenantId: tenant.id,
        },
      });
    }

    // Re-seed from scratch: pupil rows cascade to attendance/behaviour/
    // attainment. Synthetic data only — this is safe by construction.
    await systemDb.pupil.deleteMany({ where: { tenantId: tenant.id } });

    const config: SchoolConfig = {
      schoolSlug: school.slug,
      seed: school.seed,
      pupilCount: pupilsPerSchool,
      months,
      anchorDate,
    };

    let attendanceCount = 0;
    let behaviourCount = 0;
    let attainmentCount = 0;
    const riskPupils: Record<RiskPattern, string[]> = {
      "attendance-drop": [],
      "behaviour-spike": [],
      "attainment-decline": [],
      "cross-domain": [],
      "sustained-absence": [],
    };

    for (let start = 0; start < pupilsPerSchool; start += CHUNK) {
      const count = Math.min(CHUNK, pupilsPerSchool - start);
      const pupils = Array.from({ length: count }, (_, i) =>
        generatePupil(config, start + i),
      );
      const ids = pupils.map(() => randomUUID());

      await systemDb.pupil.createMany({
        data: pupils.map((p, i) => ({
          id: ids[i]!,
          tenantId: tenant.id,
          upn: p.upn,
          firstName: p.firstName,
          lastName: p.lastName,
          yearGroup: p.yearGroup,
          registrationGroup: p.registrationGroup,
          dateOfBirth: p.dateOfBirth,
        })),
      });

      await systemDb.attendanceRecord.createMany({
        data: pupils.flatMap((p, i) =>
          p.attendance.map((a) => ({
            tenantId: tenant.id,
            pupilId: ids[i]!,
            date: a.date,
            session: a.session,
            code: a.code,
            present: a.present,
            authorised: a.authorised,
          })),
        ),
      });

      await systemDb.behaviourIncident.createMany({
        data: pupils.flatMap((p, i) =>
          p.behaviour.map((b) => ({
            tenantId: tenant.id,
            pupilId: ids[i]!,
            date: b.date,
            category: b.category,
            severity: b.severity,
            description: b.description,
          })),
        ),
      });

      await systemDb.attainmentRecord.createMany({
        data: pupils.flatMap((p, i) =>
          p.attainment.map((a) => ({
            tenantId: tenant.id,
            pupilId: ids[i]!,
            subject: a.subject,
            assessedAt: a.assessedAt,
            score: a.score,
          })),
        ),
      });

      for (const p of pupils) {
        attendanceCount += p.attendance.length;
        behaviourCount += p.behaviour.length;
        attainmentCount += p.attainment.length;
        if (p.riskPattern) riskPupils[p.riskPattern].push(p.upn);
      }
      log(`${school.name}: seeded ${start + count}/${pupilsPerSchool} pupils`);
    }

    summary.schools.push({
      slug: school.slug,
      name: school.name,
      tenantId: tenant.id,
      pupils: pupilsPerSchool,
      attendanceRecords: attendanceCount,
      behaviourIncidents: behaviourCount,
      attainmentRecords: attainmentCount,
      riskPupils,
    });
  }

  return summary;
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href;

if (isDirectRun) {
  seedDatabase({ log: console.info })
    .then(async (summary) => {
      // The manifest is a dev convenience (which pupils carry which risk
      // pattern). Best-effort: in containers the code directory is
      // read-only, and a missing manifest must not fail the seed.
      const manifestPath = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "seed-manifest.json",
      );
      let manifestWritten = true;
      try {
        writeFileSync(manifestPath, JSON.stringify(summary, null, 2));
      } catch {
        manifestWritten = false;
        console.warn("seed-manifest.json not written (read-only filesystem)");
      }

      for (const school of summary.schools) {
        console.info(
          `\n${school.name}: ${school.pupils} pupils, ` +
            `${school.attendanceRecords} attendance records, ` +
            `${school.behaviourIncidents} behaviour incidents, ` +
            `${school.attainmentRecords} attainment records`,
        );
        for (const [pattern, upns] of Object.entries(school.riskPupils)) {
          console.info(`  ${pattern}: ${upns.length} pupils`);
        }
      }
      console.info(
        (manifestWritten
          ? `\nEmbedded risk pupils written to ${manifestPath}`
          : "") +
          `\n${summary.trust.name} seeded with ${summary.schools.length} schools.` +
          `\nSign in locally as a school DSL (dsl@downlands.example or` +
          ` dsl@patcham.example) or as the trust director (${summary.trust.director}).`,
      );
      await systemDb.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await systemDb.$disconnect();
      process.exit(1);
    });
}
