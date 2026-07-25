// Structured server-side error reporting (commercialisation slice 8: production
// hardening). One place every server error flows through, emitted as a single
// JSON line so CloudWatch (and a log-metric-filter alarm) can pick it up.
//
// This is the seam where a hosted error tracker drops in: a real deployment
// wires Sentry (or equivalent) here — Sentry.captureException(error, { extra:
// context }) — behind a SENTRY_DSN. That is a CTO-DECISION (see
// docs/HARDENING.md); the structured log is the honest baseline until then.
//
// Never pass a pupil's identifying data in context — errors are not a place for
// special-category data. Pass ids and paths, not names.

export type ErrorContext = Record<string, string | number | null | undefined>;

// Overridable so tests can assert what would be reported without spying on the
// console, and so a real tracker can be injected at startup.
export type ErrorSink = (error: unknown, context?: ErrorContext) => void;

const defaultSink: ErrorSink = (error, context) => {
  const err = error instanceof Error ? error : new Error(String(error));
  const payload = {
    level: "error",
    ts: new Date().toISOString(),
    name: err.name,
    message: err.message,
    stack: err.stack,
    ...context,
  };
  // A single JSON line — structured for log-based alerting.
  console.error(JSON.stringify(payload));
};

let sink: ErrorSink = defaultSink;

export function setErrorSinkForTesting(override: ErrorSink | null): void {
  sink = override ?? defaultSink;
}

export function reportError(error: unknown, context?: ErrorContext): void {
  try {
    sink(error, context);
  } catch {
    // Reporting must never throw into the request path.
  }
}
