import { TRPCError } from "@trpc/server";

import { systemTransaction, type TenantDb } from "@sentinel/db";

import type { NarrativeModel } from "./bedrock";
import { SIGNAL_NARRATIVE_PROMPT } from "./prompts";
import { assertPseudonymised, buildPseudonymisedContext } from "./pseudonymise";

export type GenerateNarrativeInput = {
  tenantId: string;
  userId: string;
  signalId: string;
};

// Generates an advisory narrative for a CONFIRMED signal.
//
// Structural guarantees, in order:
// - confirmed signals only (CLAUDE.md build step 9)
// - the model sees pseudonymised, allowlisted data — provably (fail-closed
//   scrub of the final prompt against the pupil's identifiers)
// - the narrative and its audit entry (prompt version + model id) land
//   atomically; the audit trail records every call
// - this function writes ONLY signal_narratives and audit_events. It cannot
//   touch signal state — advisory output can never trigger workflow actions.
export async function generateNarrative(
  tenantDb: TenantDb,
  model: NarrativeModel,
  input: GenerateNarrativeInput,
): Promise<{ narrativeId: string; content: string; modelId: string }> {
  const signal = await tenantDb.signal.findUnique({
    where: { id: input.signalId },
    include: {
      pupil: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          upn: true,
          yearGroup: true,
        },
      },
      ruleVersion: { select: { name: true } },
    },
  });
  if (!signal) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (signal.status !== "CONFIRMED") {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Advisory summaries are only generated for signals a DSL has confirmed.",
    });
  }

  const prompt = SIGNAL_NARRATIVE_PROMPT;
  const context = buildPseudonymisedContext(signal);
  const userMessage = prompt.build(context);

  // Fail closed: if any identifier survived into the prompt, do not call
  // the model.
  assertPseudonymised(`${prompt.system}\n${userMessage}`, [
    signal.pupil.firstName,
    signal.pupil.lastName,
    signal.pupil.upn,
  ]);

  const { text, modelId } = await model.generate(prompt.system, userMessage);

  const narrativeId = await systemTransaction(async (tx) => {
    const narrative = await tx.signalNarrative.create({
      data: {
        tenantId: input.tenantId,
        signalId: signal.id,
        pupilId: signal.pupilId,
        content: text,
        aiGenerated: true,
        promptKey: prompt.key,
        promptVersion: prompt.version,
        modelId,
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: "narrative.generated",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
        metadata: {
          narrativeId: narrative.id,
          promptKey: prompt.key,
          promptVersion: prompt.version,
          modelId,
        },
      },
    });
    return narrative.id;
  });

  return { narrativeId, content: text, modelId };
}
