import {
  dbForTenant,
  systemDb,
  Prisma,
  type RuleVersion,
} from "@sentinel/db";

import { RULES } from "./registry";
import type { RuleDefinition, RuleParams, RuleResult } from "./types";

// Postgres jsonb does not preserve key order, so param equality must be
// order-insensitive.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export type RuleRunStats = Record<
  string,
  {
    fired: number;
    created: number;
    updated: number;
    version: number;
    // The effective thresholds this run used — defaults overlaid with any
    // per-trust tuning. Recorded so a run is auditable even when tuned.
    params: RuleParams;
  }
>;

export type RuleCatalogEntry = {
  key: string;
  name: string;
  description: string;
  version: number;
  defaults: RuleParams;
};

// The rules and their default thresholds, for surfaces that let a trust tune
// them (the rules admin router). Pure metadata — runs nothing.
export function ruleCatalog(rules: RuleDefinition[] = RULES): RuleCatalogEntry[] {
  return rules.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description,
    version: r.version,
    defaults: r.params,
  }));
}

// The effective thresholds per rule for a tenant: the rule defaults overlaid
// with the tenant's trust overrides (RuleConfig). A standalone school (no
// trust) or an unconfigured trust simply gets the defaults. Overrides are
// partial — only the keys a trust changed — so an unknown or stale key in a
// config never removes a default the rule relies on.
export async function effectiveParamsForTenant(
  tenantId: string,
  rules: RuleDefinition[] = RULES,
): Promise<Map<string, RuleParams>> {
  const tenant = await systemDb.tenant.findUnique({
    where: { id: tenantId },
    select: { trustId: true },
  });
  const overrides = tenant?.trustId
    ? await systemDb.ruleConfig.findMany({ where: { trustId: tenant.trustId } })
    : [];
  const byKey = new Map(
    overrides.map((o) => [o.ruleKey, (o.params ?? {}) as RuleParams]),
  );
  const result = new Map<string, RuleParams>();
  for (const rule of rules) {
    result.set(rule.key, { ...rule.params, ...(byKey.get(rule.key) ?? {}) });
  }
  return result;
}

export type EngineRunResult = {
  executionId: string;
  status: "SUCCEEDED" | "FAILED";
  stats: RuleRunStats;
};

// Ensures every code-defined rule has its (key, version) stored with exactly
// the params the code carries. If a stored version exists with different
// params, someone changed a rule without bumping its version — refuse to
// run. Auditability depends on stored definitions matching what executed.
export async function ensureRuleVersions(
  rules: RuleDefinition[] = RULES,
): Promise<Map<string, RuleVersion>> {
  const versions = new Map<string, RuleVersion>();
  for (const rule of rules) {
    const existing = await systemDb.ruleVersion.findUnique({
      where: { key_version: { key: rule.key, version: rule.version } },
    });
    if (existing) {
      if (stableStringify(existing.params) !== stableStringify(rule.params)) {
        throw new Error(
          `Rule ${rule.key} v${rule.version} params changed in code without a ` +
            `version bump. Bump the rule's version — stored definitions are ` +
            `immutable for auditability.`,
        );
      }
      versions.set(rule.key, existing);
    } else {
      versions.set(
        rule.key,
        await systemDb.ruleVersion.create({
          data: {
            key: rule.key,
            version: rule.version,
            name: rule.name,
            description: rule.description,
            params: rule.params,
          },
        }),
      );
    }
  }
  return versions;
}

// Runs all rules for one tenant. Deterministic: same data + same asOf →
// same signals. Only creates or refreshes OPEN signals — the engine never
// touches a signal a DSL has already actioned (human-in-the-loop is
// structural, not copy).
export async function runRulesForTenant(
  tenantId: string,
  asOf: Date = new Date(),
  rules: RuleDefinition[] = RULES,
): Promise<EngineRunResult> {
  const ruleVersions = await ensureRuleVersions(rules);
  const effectiveParams = await effectiveParamsForTenant(tenantId, rules);
  const tenantDb = dbForTenant(tenantId);

  const execution = await tenantDb.ruleExecution.create({
    data: { tenantId, asOf },
  });

  const stats: RuleRunStats = {};
  try {
    for (const rule of rules) {
      const ruleVersion = ruleVersions.get(rule.key)!;
      const params = effectiveParams.get(rule.key)!;
      const results = await rule.evaluate({ tenantId, asOf, db: tenantDb }, params);
      const ruleStats = {
        fired: results.length,
        created: 0,
        updated: 0,
        version: rule.version,
        params,
      };

      for (const result of results) {
        await upsertOpenSignal(tenantDb, tenantId, execution.id, ruleVersion, result, ruleStats);
      }
      stats[rule.key] = ruleStats;
    }

    await tenantDb.ruleExecution.update({
      where: { id: execution.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
        stats: stats as unknown as Prisma.InputJsonValue,
      },
    });
    return { executionId: execution.id, status: "SUCCEEDED", stats };
  } catch (error) {
    await tenantDb.ruleExecution.update({
      where: { id: execution.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

async function upsertOpenSignal(
  tenantDb: ReturnType<typeof dbForTenant>,
  tenantId: string,
  executionId: string,
  ruleVersion: RuleVersion,
  result: RuleResult,
  ruleStats: { created: number; updated: number },
): Promise<void> {
  const data = {
    severity: result.severity,
    title: result.title,
    reasoning: result.reasoning as unknown as Prisma.InputJsonValue,
    windowStart: result.windowStart,
    windowEnd: result.windowEnd,
    executionId,
    ruleVersionId: ruleVersion.id,
  };

  // One OPEN signal per rule key per pupil: re-runs refresh it rather than
  // stacking duplicates. Actioned signals (confirmed/dismissed/escalated)
  // are never modified; a persisting condition raises a fresh OPEN signal.
  const existing = await tenantDb.signal.findFirst({
    where: {
      pupilId: result.pupilId,
      status: "OPEN",
      ruleVersion: { key: ruleVersion.key },
    },
    select: { id: true },
  });

  if (existing) {
    await tenantDb.signal.update({ where: { id: existing.id }, data });
    ruleStats.updated += 1;
  } else {
    await tenantDb.signal.create({
      data: { ...data, tenantId, pupilId: result.pupilId },
    });
    ruleStats.created += 1;
  }
}
