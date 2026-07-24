import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb } from "@sentinel/db";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import { computeBilling } from "@/server/billing/meter";
import { raiseInvoice } from "@/server/billing/invoicing";

// Billing and metering for a trust administrator (commercialisation slice 5).
// Per-pupil usage plus the flat MAT fee, metered into period snapshots, with an
// invoice lifecycle. Admin-only and strictly scoped to the admin's own trust;
// every snapshot and invoice action is audited. Billing is trust-level data,
// reached only through the system context.

// Billing has no tenant of its own; audit it against the trust's first school
// (the audit log is per-tenant), matching the admin/provisioning convention.
async function auditTenantId(trustId: string): Promise<string | null> {
  const first = await systemDb.tenant.findFirst({
    where: { trustId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

async function audit(
  trustId: string,
  userId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  const tenantId = await auditTenantId(trustId);
  if (!tenantId) return;
  await systemDb.auditEvent.create({
    data: { tenantId, userId, action, entityType: "billing", entityId, metadata },
  });
}

// Current calendar month [start, end) in UTC — the default metering period.
function currentMonth(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export const billingRouter = createTRPCRouter({
  // The current billing basis: pupils per school, the pricing, and the lines.
  summary: adminProcedure.query(async ({ ctx }) => {
    return computeBilling(ctx.adminTrustId);
  }),

  // Recent metered periods for the trust, newest first.
  snapshots: adminProcedure.query(async ({ ctx }) => {
    const snapshots = await systemDb.billingSnapshot.findMany({
      where: { trustId: ctx.adminTrustId },
      orderBy: { periodStart: "desc" },
      take: 24,
    });
    return snapshots;
  }),

  // Meter the current basis into a snapshot the pricing is frozen onto. The
  // period defaults to the current calendar month. Audited.
  takeSnapshot: adminProcedure
    .input(
      z
        .object({
          periodStart: z.coerce.date().optional(),
          periodEnd: z.coerce.date().optional(),
        })
        .optional(),
    )
    .mutation(async ({ ctx, input }) => {
      const month = currentMonth();
      const periodStart = input?.periodStart ?? month.start;
      const periodEnd = input?.periodEnd ?? month.end;
      if (periodEnd <= periodStart) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The period end must be after the start.",
        });
      }

      const basis = await computeBilling(ctx.adminTrustId);
      const snapshot = await systemDb.billingSnapshot.create({
        data: {
          trustId: ctx.adminTrustId,
          periodStart,
          periodEnd,
          pupilCount: basis.pupilCount,
          perPupilPence: basis.perPupilPence,
          matFeePence: basis.matFeePence,
          usagePence: basis.usagePence,
          totalPence: basis.totalPence,
          currency: basis.currency,
        },
      });
      await audit(ctx.adminTrustId, ctx.session.user.id, "billing.snapshot_taken", snapshot.id, {
        pupilCount: basis.pupilCount,
        totalPence: basis.totalPence,
      });
      return snapshot;
    }),

  // Raise an invoice for a drafted snapshot via the (stubbed) provider. Only a
  // DRAFT can be issued; the amounts are already frozen on the snapshot.
  issueInvoice: adminProcedure
    .input(z.object({ snapshotId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const snapshot = await systemDb.billingSnapshot.findUnique({
        where: { id: input.snapshotId },
      });
      if (!snapshot || snapshot.trustId !== ctx.adminTrustId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (snapshot.invoiceStatus !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That period has already been invoiced.",
        });
      }

      const { stripeInvoiceId } = await raiseInvoice({
        trustId: ctx.adminTrustId,
        amountPence: snapshot.totalPence,
        currency: snapshot.currency,
        description: `Sentinel Watch — ${snapshot.pupilCount} pupils + MAT fee`,
      });

      const updated = await systemDb.billingSnapshot.update({
        where: { id: snapshot.id },
        data: { invoiceStatus: "ISSUED", stripeInvoiceId },
      });
      await audit(ctx.adminTrustId, ctx.session.user.id, "billing.invoice_issued", snapshot.id, {
        stripeInvoiceId,
        totalPence: snapshot.totalPence,
      });
      return updated;
    }),
});
