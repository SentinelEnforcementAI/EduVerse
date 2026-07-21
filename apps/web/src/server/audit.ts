import type { Prisma, TenantDb } from "@sentinel/db";

// Records one audit event. Awaited by callers: an action that cannot be
// audited must not appear to succeed. The table is append-only at the
// database layer (no UPDATE/DELETE policies exist).
export async function recordAuditEvent(
  tenantDb: TenantDb,
  event: {
    tenantId: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId?: string;
    pupilId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await tenantDb.auditEvent.create({
    data: {
      tenantId: event.tenantId,
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      pupilId: event.pupilId,
      metadata: event.metadata,
    },
  });
}
