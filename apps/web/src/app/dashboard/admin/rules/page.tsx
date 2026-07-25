import { redirect } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { serverApi } from "@/trpc/server";

import { RuleTuner } from "./rules-client";

// Rules tuning (commercialisation slice 7). A trust administrator calibrates the
// five rules' thresholds to their own context, with safeguarding leads. Every
// change is audited, and the engine records the effective thresholds on each
// run. Admin-only.
export default async function RulesPage() {
  const api = await serverApi();

  let rules;
  try {
    rules = await api.rules.list();
  } catch (error) {
    if (error instanceof TRPCError && error.code === "FORBIDDEN") {
      redirect("/dashboard");
    }
    throw error;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Rules</h1>
      <p className="mt-1 text-base text-muted-foreground">
        The thresholds the risk engine uses to raise a concern. Tune them to your
        trust with your safeguarding leads — the engine runs first, always; these
        change only when a rule fires, never whether a human decides.
      </p>

      <div className="mt-6 space-y-4">
        {rules.map((rule) => (
          <RuleTuner key={rule.key} rule={rule} />
        ))}
      </div>
    </div>
  );
}
