import type { PseudonymisedContext } from "./pseudonymise";

// Versioned prompt templates. Changing the wording of a prompt requires
// bumping its version — every stored narrative records the (key, version)
// that produced it, so the audit trail can always reconstruct exactly what
// was asked of the model.

export type NarrativePrompt = {
  key: string;
  version: number;
  system: string;
  build(context: PseudonymisedContext): string;
};

// The deterministic fallback narrative (spec principle 9): a complete, sensible
// advisory summary built from the pseudonymised context when the model is
// unavailable. Never throws, never empty. UK English, no recommendations.
export function buildFallbackNarrative(context: PseudonymisedContext): string {
  const metrics = Object.entries(context.metrics)
    .map(([key, value]) => `${key} ${value}`)
    .join(", ");
  const first = context.ruleSummary
    ? context.ruleSummary
    : `The rule "${context.ruleName}" fired for a pupil in year ${context.yearGroup} over ${context.windowStart} to ${context.windowEnd}.`;
  const second = metrics
    ? `The computed values behind this pattern were: ${metrics}. An experienced DSL may want to look at the underlying records for that window.`
    : "An experienced DSL may want to look at the underlying records for that window.";
  return `${first}\n\n${second}`;
}

export const SIGNAL_NARRATIVE_PROMPT: NarrativePrompt = {
  key: "signal-narrative",
  version: 1,
  system: [
    "You assist a Designated Safeguarding Lead (DSL) in a UK school by",
    "summarising the statistical pattern behind a safeguarding signal that",
    "the DSL has already confirmed. The data you receive is pseudonymised:",
    "you know nothing about who the pupil is, and you must not speculate",
    "about identity, family, or cause. Write in UK English.",
    "",
    "Your output is advisory only. Do not recommend decisions, actions,",
    "referrals, or interventions — the DSL decides. Do not diagnose.",
    "Describe what the numbers show, what makes this pattern notable, and",
    "what an experienced DSL might want to look at in the underlying data.",
    "Write two short paragraphs of plain prose. No headings, no lists.",
  ].join("\n"),
  build(context) {
    const metrics = Object.entries(context.metrics)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");
    return [
      `A rule named "${context.ruleName}" (severity ${context.severity} of 3)`,
      `fired for a pupil in year ${context.yearGroup}.`,
      `The evaluation window was ${context.windowStart} to ${context.windowEnd}.`,
      "",
      `The rule's own explanation of why it fired:`,
      context.ruleSummary,
      "",
      "The computed metrics behind the signal:",
      metrics,
      "",
      "Summarise this pattern for the DSL.",
    ].join("\n");
  },
};
