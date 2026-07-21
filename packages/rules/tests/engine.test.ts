import { describe, expect, it } from "vitest";

import { dbForTenant, systemDb } from "@sentinel/db";

import { seedDatabase } from "../../db/prisma/seed";
import type { RiskPattern } from "../../db/src/synthetic/generator";
import { ensureRuleVersions, runRulesForTenant } from "../src/engine";
import { RULES } from "../src/registry";

// The engine validated against ground truth: the synthetic dataset embeds
// known risk patterns, and every embedded pattern must be found by its rule.

const ANCHOR = new Date(Date.UTC(2026, 6, 21));

const PATTERN_TO_RULE: Record<RiskPattern, string> = {
  "attendance-drop": "attendance-drop",
  "behaviour-spike": "behaviour-spike",
  "attainment-decline": "attainment-decline",
  "cross-domain": "cross-domain",
  "sustained-absence": "sustained-absence",
};

describe("rule versioning", () => {
  it("stores every rule definition and refuses silent param drift", async () => {
    const versions = await ensureRuleVersions();
    expect(versions.size).toBe(RULES.length);

    const tampered = {
      ...RULES[0]!,
      params: { ...RULES[0]!.params, minDropPercentagePoints: 1 },
    };
    await expect(ensureRuleVersions([tampered])).rejects.toThrow(
      /version bump/,
    );
  });
});

describe("engine against embedded ground truth", () => {
  it("finds every embedded risk pattern and stays quiet on healthy pupils", async () => {
    const summary = await seedDatabase({
      pupilsPerSchool: 40,
      months: 12,
      anchorDate: ANCHOR,
    });
    const school = summary.schools.find((s) => s.slug === "downlands")!;

    const result = await runRulesForTenant(school.tenantId, ANCHOR);
    expect(result.status).toBe("SUCCEEDED");

    const signals = await dbForTenant(school.tenantId).signal.findMany({
      include: { ruleVersion: true, pupil: { select: { upn: true } } },
    });

    // Every embedded pattern pupil is flagged by the matching rule.
    for (const [pattern, upns] of Object.entries(school.riskPupils)) {
      const ruleKey = PATTERN_TO_RULE[pattern as RiskPattern];
      for (const upn of upns) {
        const match = signals.find(
          (s) => s.pupil.upn === upn && s.ruleVersion.key === ruleKey,
        );
        expect(match, `${pattern} pupil ${upn} should trigger ${ruleKey}`).toBeDefined();
        // Explainability contract: reasoning present and populated.
        const reasoning = match!.reasoning as {
          summary: string;
          metrics: Record<string, unknown>;
          dataPoints: unknown[];
        };
        expect(reasoning.summary.length).toBeGreaterThan(20);
        expect(Object.keys(reasoning.metrics).length).toBeGreaterThan(1);
      }
    }

    // Precision: the engine must not blanket-flag the school. At most the
    // 5 embedded risk pupils plus a small tolerance for borderline noise.
    const flaggedPupils = new Set(signals.map((s) => s.pupilId));
    const riskCount = Object.values(school.riskPupils).flat().length;
    expect(flaggedPupils.size).toBeLessThanOrEqual(riskCount + 3);

    // Execution log records the run and its stats.
    const execution = await dbForTenant(school.tenantId).ruleExecution.findFirst({
      where: { id: result.executionId },
    });
    expect(execution?.status).toBe("SUCCEEDED");
    expect(execution?.stats).toBeTruthy();
  }, 180_000);

  it("re-running refreshes OPEN signals instead of duplicating, and leaves actioned signals alone", async () => {
    const tenant = await systemDb.tenant.findUnique({
      where: { slug: "downlands" },
    });
    const tenantDb = dbForTenant(tenant!.id);

    const before = await tenantDb.signal.count();
    expect(before).toBeGreaterThan(0);

    // A DSL has actioned one signal — the engine must not touch it.
    const actioned = await tenantDb.signal.findFirst({ where: { status: "OPEN" } });
    await tenantDb.signal.update({
      where: { id: actioned!.id },
      data: { status: "DISMISSED" },
    });

    const second = await runRulesForTenant(tenant!.id, ANCHOR);
    const totals = Object.values(second.stats).reduce(
      (acc, s) => ({ created: acc.created + s.created, updated: acc.updated + s.updated }),
      { created: 0, updated: 0 },
    );
    // The dismissed signal's condition still holds, so exactly one fresh
    // OPEN signal is created; everything else refreshes in place.
    expect(totals.created).toBe(1);

    const after = await tenantDb.signal.count();
    expect(after).toBe(before + 1);

    const untouched = await tenantDb.signal.findUnique({
      where: { id: actioned!.id },
    });
    expect(untouched?.status).toBe("DISMISSED");
  }, 120_000);
});
