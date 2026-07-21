import { parseArgs } from "node:util";

import { systemDb } from "@sentinel/db";

import { runRulesForTenant } from "./engine";

// Runs the rules engine for a tenant: pnpm rules --tenant downlands
// CTO-DECISION: scheduling (nightly per school? after each sync?). Manual
// CLI runs are the simplest working version for the design-partner MVP.

async function main() {
  const { values } = parseArgs({
    options: {
      tenant: { type: "string" },
      "as-of": { type: "string" },
    },
  });
  if (!values.tenant) {
    throw new Error("Usage: pnpm rules --tenant <slug> [--as-of YYYY-MM-DD]");
  }
  const tenant = await systemDb.tenant.findUnique({
    where: { slug: values.tenant },
  });
  if (!tenant) throw new Error(`Unknown tenant slug: ${values.tenant}`);

  const asOf = values["as-of"] ? new Date(values["as-of"]) : new Date();
  console.info(`Running rules for ${tenant.name} as of ${asOf.toISOString().slice(0, 10)}`);

  const result = await runRulesForTenant(tenant.id, asOf);
  for (const [key, s] of Object.entries(result.stats)) {
    console.info(
      `  ${key} v${s.version}: ${s.fired} fired (${s.created} new, ${s.updated} refreshed)`,
    );
  }
  console.info(`Execution ${result.executionId} ${result.status}`);
  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await systemDb.$disconnect();
  process.exit(1);
});
