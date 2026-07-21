import { TRPCError } from "@trpc/server";

import {
  systemTransaction,
  type DecisionKind,
  type SignalStatus,
  type TenantDb,
} from "@sentinel/db";

const STATUS_BY_KIND: Record<DecisionKind, SignalStatus> = {
  CONFIRM: "CONFIRMED",
  DISMISS: "DISMISSED",
  ESCALATE: "ESCALATED",
};

export type DecideInput = {
  tenantId: string;
  userId: string;
  signalId: string;
  kind: DecisionKind;
  note: string | null;
};

// Applies a DSL's decision to a signal. The three writes — status
// transition, append-only decision record, audit entry — land atomically:
// a decision that cannot be recorded and audited does not happen.
//
// Only OPEN signals can be decided. CTO-DECISION: whether a decided signal
// can be re-opened, and by whom. Until then the engine raises a fresh signal
// if the condition persists after a dismissal.
export async function decideSignal(
  tenantDb: TenantDb,
  input: DecideInput,
): Promise<{ decisionId: string; status: SignalStatus }> {
  if (input.kind === "DISMISS" && (input.note?.trim().length ?? 0) < 5) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Dismissing a signal requires a note explaining why — it becomes part of the safeguarding record.",
    });
  }

  // Tenant-scoped read proves the signal belongs to the caller's school
  // before any system-context write happens.
  const signal = await tenantDb.signal.findUnique({
    where: { id: input.signalId },
    select: { id: true, status: true, pupilId: true, tenantId: true },
  });
  if (!signal) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
  if (signal.status !== "OPEN") {
    throw new TRPCError({
      code: "CONFLICT",
      message: `This signal has already been ${signal.status.toLowerCase()}.`,
    });
  }

  const status = STATUS_BY_KIND[input.kind];
  const note = input.note?.trim() || null;

  const decisionId = await systemTransaction(async (tx) => {
    // Guarded transition: if another DSL decided in the meantime, zero rows
    // match and the whole transaction rolls back.
    const transition = await tx.signal.updateMany({
      where: { id: signal.id, tenantId: input.tenantId, status: "OPEN" },
      data: { status },
    });
    if (transition.count !== 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This signal was decided by someone else just now.",
      });
    }

    const decision = await tx.signalDecision.create({
      data: {
        tenantId: input.tenantId,
        signalId: signal.id,
        pupilId: signal.pupilId,
        userId: input.userId,
        kind: input.kind,
        note,
      },
    });

    await tx.auditEvent.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: "signal.decided",
        entityType: "signal",
        entityId: signal.id,
        pupilId: signal.pupilId,
        metadata: { kind: input.kind, decisionId: decision.id },
      },
    });

    return decision.id;
  });

  return { decisionId, status };
}
