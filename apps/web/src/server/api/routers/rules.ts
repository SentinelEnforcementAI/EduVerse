import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb } from "@sentinel/db";
import { ruleCatalog, type RuleParams } from "@sentinel/rules";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";

// Rules tuning for a trust administrator (commercialisation slice 7). The five
// rules ship with default thresholds; a trust tunes them to its own context
// here, without a code change. Admin-only, strictly scoped to the admin's own
// trust, every change audited. The tuning is trust-level config, reached only
// through the system context; the engine reads it at run time and records the
// effective thresholds on every run, so a tuned run stays auditable.

const CATALOG = ruleCatalog();
const CATALOG_BY_KEY = new Map(CATALOG.map((r) => [r.key, r]));

// A submitted override must only set known keys for the rule, each a positive,
// finite number (thresholds are days, counts and percentage points).
function validateOverride(ruleKey: string, params: RuleParams): void {
  const entry = CATALOG_BY_KEY.get(ruleKey);
  if (!entry) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown rule." });
  }
  for (const [key, value] of Object.entries(params)) {
    if (!(key in entry.defaults)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `"${key}" is not a threshold of ${entry.name}.`,
      });
    }
    if (!Number.isFinite(value) || value <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `"${key}" must be a positive number.`,
      });
    }
  }
}

async function auditTenantId(trustId: string): Promise<string | null> {
  const first = await systemDb.tenant.findFirst({
    where: { trustId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

async function audit(
  trustId: string,
  userId: string,
  action: string,
  ruleKey: string,
  metadata: Record<string, unknown>,
) {
  const tenantId = await auditTenantId(trustId);
  if (!tenantId) return;
  await systemDb.auditEvent.create({
    data: { tenantId, userId, action, entityType: "rule", entityId: ruleKey, metadata },
  });
}

export const rulesRouter = createTRPCRouter({
  // Every rule with its defaults, the trust's current override (if any) and the
  // resulting effective thresholds.
  list: adminProcedure.query(async ({ ctx }) => {
    const configs = await systemDb.ruleConfig.findMany({
      where: { trustId: ctx.adminTrustId },
    });
    const overrideByKey = new Map(
      configs.map((c) => [c.ruleKey, (c.params ?? {}) as RuleParams]),
    );
    return CATALOG.map((rule) => {
      const override = overrideByKey.get(rule.key) ?? {};
      return {
        key: rule.key,
        name: rule.name,
        description: rule.description,
        version: rule.version,
        defaults: rule.defaults,
        override,
        effective: { ...rule.defaults, ...override } as RuleParams,
        tuned: Object.keys(override).length > 0,
      };
    });
  }),

  // Set (or clear) the trust's threshold overrides for one rule. An empty
  // params object resets the rule to its defaults. Validated and audited.
  setThresholds: adminProcedure
    .input(
      z.object({
        ruleKey: z.string(),
        params: z.record(z.string(), z.number()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      validateOverride(input.ruleKey, input.params);

      await systemDb.ruleConfig.upsert({
        where: {
          trustId_ruleKey: { trustId: ctx.adminTrustId, ruleKey: input.ruleKey },
        },
        update: { params: input.params, updatedById: ctx.session.user.id },
        create: {
          trustId: ctx.adminTrustId,
          ruleKey: input.ruleKey,
          params: input.params,
          updatedById: ctx.session.user.id,
        },
      });
      await audit(ctx.adminTrustId, ctx.session.user.id, "rule.thresholds_set", input.ruleKey, {
        params: input.params,
      });
      return { ok: true };
    }),

  // Reset a rule to its defaults (clears the override in place — the config row
  // is never deleted, so the change is visible in the audit trail).
  reset: adminProcedure
    .input(z.object({ ruleKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!CATALOG_BY_KEY.has(input.ruleKey)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown rule." });
      }
      await systemDb.ruleConfig.upsert({
        where: {
          trustId_ruleKey: { trustId: ctx.adminTrustId, ruleKey: input.ruleKey },
        },
        update: { params: {}, updatedById: ctx.session.user.id },
        create: {
          trustId: ctx.adminTrustId,
          ruleKey: input.ruleKey,
          params: {},
          updatedById: ctx.session.user.id,
        },
      });
      await audit(ctx.adminTrustId, ctx.session.user.id, "rule.thresholds_reset", input.ruleKey, {});
      return { ok: true };
    }),
});
