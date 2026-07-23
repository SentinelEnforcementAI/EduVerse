import { createHash } from "node:crypto";

import type { TenantDb } from "@sentinel/db";

// The advisory LLM layer (spec 9 / build order step 15). Every generated
// surface runs through here: an optional LLM enhancement over a deterministic
// fallback that always produces a complete, sensible output. If the model
// times out, errors, or is unavailable, the fallback is used SILENTLY — a user
// never sees an error, a stack trace, or an empty panel (principle 9). Every
// call is logged (prompt version, input hash, source), and the output is always
// advisory: this layer is never authoritative.

export type AdviseResult = {
  text: string;
  source: "llm" | "fallback";
  modelId: string | null;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("advisory timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function advise(
  tenantDb: TenantDb,
  opts: {
    tenantId: string;
    surface: string;
    signalId?: string;
    promptKey: string;
    promptVersion: number;
    // The (pseudonymised) input, hashed for the log — never stored raw.
    input: string;
    fallback: () => string;
    enhance?: () => Promise<{ text: string; modelId: string }>;
    timeoutMs?: number;
  },
): Promise<AdviseResult> {
  let text = opts.fallback();
  let source: "llm" | "fallback" = "fallback";
  let modelId: string | null = null;

  if (opts.enhance) {
    try {
      const result = await withTimeout(opts.enhance(), opts.timeoutMs ?? 20_000);
      const trimmed = result.text.trim();
      if (trimmed) {
        text = trimmed;
        source = "llm";
        modelId = result.modelId;
      }
    } catch {
      // Fall back silently. This is the product guarantee, not an optimisation.
    }
  }

  // Log the call. Logging is best-effort: a logging failure must never break
  // the surface the user is looking at.
  try {
    await tenantDb.llmCall.create({
      data: {
        tenantId: opts.tenantId,
        surface: opts.surface,
        signalId: opts.signalId ?? null,
        promptKey: opts.promptKey,
        promptVersion: opts.promptVersion,
        inputHash: sha256(opts.input),
        source,
        modelId,
        advisory: true,
      },
    });
  } catch {
    // ignore
  }

  return { text, source, modelId };
}
