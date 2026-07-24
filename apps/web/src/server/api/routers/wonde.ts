import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb } from "@sentinel/db";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";
import {
  WondeDirectoryError,
  isWondeConfigured,
  listWondeSchools,
} from "@/server/wonde/directory";

// Wonde self-connect (commercialisation slice 3). A trust administrator maps
// each school (tenant) to its Wonde school during onboarding, replacing the
// operator-set environment key + CLI link. Admin-only, strictly trust-scoped,
// every link and unlink audited. Reads pupil data from Wonde only — never
// writes back (overlay-first, CLAUDE.md).

async function trustSchools(trustId: string) {
  return systemDb.tenant.findMany({
    where: { trustId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      wondeSchoolId: true,
      wondeSchoolName: true,
      wondeConnectedAt: true,
    },
  });
}

// A tenant that must belong to the admin's trust — the only way a tenantId
// reaches a write, so an admin can never link a school outside their trust.
async function loadTenantInTrust(tenantId: string, trustId: string) {
  const tenant = await systemDb.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
  if (tenant.trustId !== trustId) throw new TRPCError({ code: "FORBIDDEN" });
  return tenant;
}

async function fetchWondeSchools() {
  try {
    return await listWondeSchools();
  } catch (error) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        error instanceof WondeDirectoryError
          ? `Could not reach Wonde: ${error.message}`
          : "Could not reach Wonde.",
    });
  }
}

export const wondeRouter = createTRPCRouter({
  // Connection state for the trust: whether a token is configured, and each
  // school's link status. DB only — no Wonde call, so it is cheap to render.
  overview: adminProcedure.query(async ({ ctx }) => {
    const schools = await trustSchools(ctx.adminTrustId);
    return {
      configured: isWondeConfigured(),
      schools: schools.map((s) => ({
        tenantId: s.id,
        name: s.name,
        wondeSchoolId: s.wondeSchoolId,
        wondeSchoolName: s.wondeSchoolName,
        connectedAt: s.wondeConnectedAt,
      })),
    };
  }),

  // The Wonde schools available to link: those the token can reach, minus any
  // already linked to a school in this trust. Makes the live Wonde call, so the
  // UI fetches it only when the admin opens the connect panel.
  availableSchools: adminProcedure.query(async ({ ctx }) => {
    if (!isWondeConfigured()) return { configured: false, schools: [] };
    const all = await fetchWondeSchools();
    const linked = new Set(
      (await trustSchools(ctx.adminTrustId))
        .map((s) => s.wondeSchoolId)
        .filter((id): id is string => id !== null),
    );
    return {
      configured: true,
      schools: all.filter((s) => !linked.has(s.id)),
    };
  }),

  // Link a school to its Wonde school. Validates the id against the live token
  // (an admin can only pick a school the connection can actually reach) and
  // that it is not already linked to another tenant.
  link: adminProcedure
    .input(z.object({ tenantId: z.string(), wondeSchoolId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await loadTenantInTrust(input.tenantId, ctx.adminTrustId);

      const reachable = await fetchWondeSchools();
      const match = reachable.find((s) => s.id === input.wondeSchoolId);
      if (!match) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That school is not available to your Wonde connection.",
        });
      }

      // wonde_school_id is globally unique; guard for a clearer message than the
      // raw constraint error if it is already linked elsewhere.
      const already = await systemDb.tenant.findUnique({
        where: { wondeSchoolId: input.wondeSchoolId },
        select: { id: true },
      });
      if (already && already.id !== tenant.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "That Wonde school is already linked to another school.",
        });
      }

      await systemDb.tenant.update({
        where: { id: tenant.id },
        data: {
          wondeSchoolId: input.wondeSchoolId,
          wondeSchoolName: match.name,
          wondeConnectedAt: new Date(),
        },
      });
      await systemDb.auditEvent.create({
        data: {
          tenantId: tenant.id,
          userId: ctx.session.user.id,
          action: "wonde.linked",
          entityType: "tenant",
          entityId: tenant.id,
          metadata: {
            wondeSchoolId: input.wondeSchoolId,
            wondeSchoolName: match.name,
            via: "onboarding",
          },
        },
      });
      return { ok: true, wondeSchoolName: match.name };
    }),

  // Disconnect a school from Wonde. Future syncs stop; data already synced is
  // kept (safeguarding records are never hard-deleted). Audited.
  unlink: adminProcedure
    .input(z.object({ tenantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tenant = await loadTenantInTrust(input.tenantId, ctx.adminTrustId);
      await systemDb.tenant.update({
        where: { id: tenant.id },
        data: {
          wondeSchoolId: null,
          wondeSchoolName: null,
          wondeConnectedAt: null,
        },
      });
      await systemDb.auditEvent.create({
        data: {
          tenantId: tenant.id,
          userId: ctx.session.user.id,
          action: "wonde.unlinked",
          entityType: "tenant",
          entityId: tenant.id,
          metadata: {
            wondeSchoolId: tenant.wondeSchoolId,
            via: "onboarding",
          },
        },
      });
      return { ok: true };
    }),
});
