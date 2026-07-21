// Pseudonymisation for LLM inference. Two layers, both mandatory:
//
// 1. Allowlist construction — the context sent to the model is built only
//    from structured, non-identifying fields (year group, rule metadata,
//    computed metrics, dates). Names, UPNs, dates of birth, registration
//    groups, and ALL free-text fields (behaviour descriptions, decision
//    notes, data-point labels) are never included in v1.
// 2. Fail-closed scrubbing — before anything leaves the process, the final
//    prompt text is checked against the pupil's known identifiers. If one
//    appears anywhere (e.g. smuggled through a metric value), generation
//    throws instead of calling the model.

export type PseudonymisedContext = {
  yearGroup: number;
  ruleName: string;
  severity: number;
  windowStart: string;
  windowEnd: string;
  ruleSummary: string;
  metrics: Record<string, string | number>;
};

export class PseudonymisationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PseudonymisationError";
  }
}

type SignalForNarrative = {
  severity: number;
  windowStart: Date;
  windowEnd: Date;
  reasoning: unknown;
  pupil: { yearGroup: number };
  ruleVersion: { name: string };
};

// Builds the model context from the allowlist. Note what is absent: pupil
// name, UPN, date of birth, registration group, and reasoning.dataPoints
// (whose labels can carry free text originating from MIS records).
export function buildPseudonymisedContext(
  signal: SignalForNarrative,
): PseudonymisedContext {
  const reasoning = (signal.reasoning ?? {}) as {
    summary?: unknown;
    metrics?: Record<string, unknown>;
  };

  const metrics: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(reasoning.metrics ?? {})) {
    if (typeof value === "number" || typeof value === "string") {
      metrics[key] = value;
    }
  }

  return {
    yearGroup: signal.pupil.yearGroup,
    ruleName: signal.ruleVersion.name,
    severity: signal.severity,
    windowStart: signal.windowStart.toISOString().slice(0, 10),
    windowEnd: signal.windowEnd.toISOString().slice(0, 10),
    ruleSummary: typeof reasoning.summary === "string" ? reasoning.summary : "",
    metrics,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Throws if any known identifier for the pupil appears in the payload.
// Case-insensitive, word-boundary matched. Deliberately fail-closed: a
// false positive blocks one narrative; a false negative leaks a child's
// identity to an external service.
export function assertPseudonymised(
  payload: string,
  identifiers: string[],
): void {
  for (const identifier of identifiers) {
    const trimmed = identifier.trim();
    if (trimmed.length < 2) continue;
    const pattern = new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i");
    if (pattern.test(payload)) {
      throw new PseudonymisationError(
        "Pseudonymisation check failed: an identifying value would have " +
          "reached the model. The narrative was not generated.",
      );
    }
  }
}
