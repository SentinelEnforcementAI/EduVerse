import type { TenantDb } from "@sentinel/db";

// The explainability contract. Every signal carries this: what fired, the
// computed values against their thresholds, and the underlying data points.
// No unexplained scores — this is a non-negotiable principle, not styling.
export type SignalReasoning = {
  summary: string;
  metrics: Record<string, number | string>;
  dataPoints: { label: string; date?: string; value: string | number }[];
};

export type RuleResult = {
  pupilId: string;
  severity: 1 | 2 | 3;
  title: string;
  reasoning: SignalReasoning;
  windowStart: Date;
  windowEnd: Date;
};

export type RuleContext = {
  tenantId: string;
  asOf: Date;
  // Reads go through the tenant-scoped client: a rule is physically unable
  // to read another school's data, whatever its code does.
  db: TenantDb;
};

// A rule's thresholds. Numbers only — days, counts, percentage points — so a
// trust can tune them and the engine can validate them generically.
export type RuleParams = Record<string, number>;

export type RuleDefinition = {
  key: string;
  version: number;
  name: string;
  description: string;
  // The default thresholds. A per-trust RuleConfig overrides these at run time;
  // the effective params are passed to evaluate().
  params: RuleParams;
  evaluate(ctx: RuleContext, params?: RuleParams): Promise<RuleResult[]>;
};
