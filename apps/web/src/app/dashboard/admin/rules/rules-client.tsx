"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/trpc/react";

type Rule = {
  key: string;
  name: string;
  description: string;
  defaults: Record<string, number>;
  effective: Record<string, number>;
  tuned: boolean;
};

const inputClass =
  "w-24 rounded-md border border-cloud bg-card px-2 py-1 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// "minDropPercentagePoints" → "Min drop percentage points"
function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Per-rule threshold tuning. The inputs start from the effective values; Save
// sends only the thresholds that differ from the defaults as the trust's
// override, so an unchanged rule stays on defaults.
export function RuleTuner({ rule }: { rule: Rule }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(rule.effective);

  const setThresholds = api.rules.setThresholds.useMutation({
    onSuccess: () => router.refresh(),
  });
  const reset = api.rules.reset.useMutation({ onSuccess: () => router.refresh() });

  const keys = Object.keys(rule.defaults);
  const dirty = keys.some((k) => values[k] !== rule.effective[k]);

  function save() {
    const override: Record<string, number> = {};
    for (const k of keys) {
      if (values[k] !== rule.defaults[k]) override[k] = values[k]!;
    }
    setThresholds.mutate({ ruleKey: rule.key, params: override });
  }

  return (
    <div className="rounded-xl border border-cloud bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{rule.name}</h2>
        {rule.tuned ? (
          <span className="rounded-full bg-cobalt-tint px-2 py-0.5 text-xs font-semibold text-cobalt">
            Tuned
          </span>
        ) : (
          <span className="rounded-full bg-cloud px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            Defaults
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-muted-foreground">{rule.description}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {keys.map((k) => {
          const changed = values[k] !== rule.defaults[k];
          return (
            <label
              key={k}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-muted-foreground">{humanize(k)}</span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  className={inputClass}
                  value={values[k] ?? rule.defaults[k]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [k]: Number(e.target.value) }))
                  }
                />
                {changed ? (
                  <span className="w-16 text-xs text-muted-foreground">
                    def {rule.defaults[k]}
                  </span>
                ) : (
                  <span className="w-16" />
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button size="sm" disabled={!dirty || setThresholds.isPending} onClick={save}>
          {setThresholds.isPending ? "Saving…" : "Save thresholds"}
        </Button>
        {rule.tuned ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={reset.isPending}
            onClick={() => reset.mutate({ ruleKey: rule.key })}
          >
            <RotateCcw className="size-4" aria-hidden />
            Reset to defaults
          </Button>
        ) : null}
        {setThresholds.error ? (
          <span className="text-sm text-risk">{setThresholds.error.message}</span>
        ) : null}
      </div>
    </div>
  );
}
