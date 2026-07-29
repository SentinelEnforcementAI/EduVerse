import { parseArgs } from "node:util";

import { systemDb } from "@sentinel/db";

import { syncEnv, requireWondeApiKey } from "../src/env";
import { syncSandboxSchool } from "../src/sandbox";
import { HttpWondeTransport, WondeClient } from "../src/wonde/client";

// Connect the Wonde sandbox school into the demo trust as a live, engine-
// analysed school, in one pass. Needs WONDE_API_KEY (from Secrets Manager in
// prod) and the sandbox school id.
//
//   pnpm --filter @sentinel/sync sync:sandbox \
//     --school-id <wonde-school-id> --name "Wonde Sandbox" --slug wonde-sandbox

async function main() {
  const { values } = parseArgs({
    options: {
      "school-id": { type: "string" },
      slug: { type: "string", default: "wonde-sandbox" },
      name: { type: "string", default: "Wonde Sandbox School" },
      trust: { type: "string", default: "weald-learning-trust" },
    },
  });

  const wondeSchoolId = values["school-id"] ?? syncEnv().WONDE_SCHOOL_ID;
  if (!wondeSchoolId) {
    throw new Error(
      "Provide --school-id <wonde school id> (or set WONDE_SCHOOL_ID). " +
        "List reachable schools first with the Wonde /schools endpoint.",
    );
  }

  const client = new WondeClient(
    new HttpWondeTransport(requireWondeApiKey(), syncEnv().WONDE_BASE_URL),
  );

  const report = await syncSandboxSchool(client, {
    trustSlug: values.trust!,
    schoolSlug: values.slug!,
    schoolName: values.name!,
    wondeSchoolId,
  });

  console.info(JSON.stringify(report, null, 2));
  console.info(
    `\nConnected "${report.schoolSlug}" to Wonde school ${report.wondeSchoolId}: ` +
      `${report.students.created + report.students.updated} pupils, ` +
      `rules ${report.rulesStatus}, ${report.openSignals} open signals.`,
  );
  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await systemDb.$disconnect();
  process.exit(1);
});
