import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { systemDb } from "@sentinel/db";

import { adminProcedure, createTRPCRouter } from "@/server/api/trpc";

// In-product user management for a trust administrator (commercialisation slice
// 1: access foundation). Replaces the CLI-only provisioning. Every read and
// write is scoped strictly to the admin's own trust, and every change is
// audited. Accounts are never hard deleted — deactivation is soft.

const RoleInput = z.enum(["DSL", "DIRECTOR", "ADMIN"]);

type Scoped = { trustId: string; schoolIds: string[]; firstSchoolId: string | null };

async function trustScope(trustId: string): Promise<Scoped & { schools: { id: string; name: string }[] }> {
  const schools = await systemDb.tenant.findMany({
    where: { trustId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return {
    trustId,
    schoolIds: schools.map((s) => s.id),
    firstSchoolId: schools[0]?.id ?? null,
    schools,
  };
}

// A target user must belong to the admin's trust: a trust-level account with
// this trustId, or a school account in one of the trust's schools. This is the
// only way a userId reaches a write, so an admin can never touch another
// trust's accounts.
async function loadTargetInTrust(userId: string, scope: Scoped) {
  const user = await systemDb.user.findUnique({ where: { id: userId } });
  if (!user) throw new TRPCError({ code: "NOT_FOUND" });
  const inTrust =
    user.trustId === scope.trustId ||
    (user.tenantId !== null && scope.schoolIds.includes(user.tenantId));
  if (!inTrust) throw new TRPCError({ code: "FORBIDDEN" });
  return user;
}

// Where an account's actions are audited: its own school, or the trust's first
// school for a trust-level account (the audit log is per-tenant).
function auditTenantId(
  target: { tenantId: string | null },
  scope: Scoped,
): string | null {
  return target.tenantId ?? scope.firstSchoolId;
}

export const adminRouter = createTRPCRouter({
  // Every account in the trust, with its role, status and where it sits.
  users: adminProcedure.query(async ({ ctx }) => {
    const scope = await trustScope(ctx.adminTrustId);
    const schoolName = new Map(scope.schools.map((s) => [s.id, s.name]));
    const users = await systemDb.user.findMany({
      where: {
        OR: [
          { trustId: scope.trustId },
          { tenantId: { in: scope.schoolIds } },
        ],
      },
      orderBy: [{ status: "asc" }, { role: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        tenantId: true,
        trustId: true,
        createdAt: true,
      },
    });
    return {
      selfId: ctx.session.user.id,
      schools: scope.schools,
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        status: u.status,
        scope: u.tenantId
          ? (schoolName.get(u.tenantId) ?? "School")
          : "Whole trust",
      })),
    };
  }),

  // Invite (provision) a new account. Invite-only sign-in is unchanged: this
  // creates the account, the person then requests a magic link.
  invite: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().trim().max(120).optional(),
        role: RoleInput,
        schoolId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await trustScope(ctx.adminTrustId);
      const email = input.email.trim().toLowerCase();

      const existing = await systemDb.user.findUnique({ where: { email } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with that email already exists.",
        });
      }

      const data =
        input.role === "DSL"
          ? (() => {
              if (!input.schoolId || !scope.schoolIds.includes(input.schoolId)) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Choose a school for a DSL account.",
                });
              }
              return {
                email,
                name: input.name ?? null,
                role: "DSL" as const,
                tenantId: input.schoolId,
              };
            })()
          : {
              email,
              name: input.name ?? null,
              role: input.role,
              trustId: scope.trustId,
            };

      const user = await systemDb.user.create({ data });
      const tenantId = auditTenantId(user, scope);
      if (tenantId) {
        await systemDb.auditEvent.create({
          data: {
            tenantId,
            userId: ctx.session.user.id,
            action: "user.provisioned",
            entityType: "user",
            entityId: user.id,
            metadata: { email, role: input.role, via: "admin-ui" },
          },
        });
      }
      return { id: user.id };
    }),

  // Change an account's role. The scope moves with the role: a DSL sits in a
  // school, a director or admin at the trust.
  setRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: RoleInput,
        schoolId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await trustScope(ctx.adminTrustId);
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role.",
        });
      }
      const target = await loadTargetInTrust(input.userId, scope);

      const data =
        input.role === "DSL"
          ? (() => {
              if (!input.schoolId || !scope.schoolIds.includes(input.schoolId)) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "Choose a school for a DSL account.",
                });
              }
              return {
                role: "DSL" as const,
                tenantId: input.schoolId,
                trustId: null,
              };
            })()
          : { role: input.role, trustId: scope.trustId, tenantId: null };

      const updated = await systemDb.user.update({
        where: { id: target.id },
        data,
      });
      const tenantId = auditTenantId(updated, scope);
      if (tenantId) {
        await systemDb.auditEvent.create({
          data: {
            tenantId,
            userId: ctx.session.user.id,
            action: "user.role_changed",
            entityType: "user",
            entityId: target.id,
            metadata: { from: target.role, to: input.role, via: "admin-ui" },
          },
        });
      }
      return { ok: true };
    }),

  // Deactivate or reactivate an account. Deactivation is soft (the row stays)
  // and revokes any live sessions immediately.
  setStatus: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        status: z.enum(["ACTIVE", "DEACTIVATED"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const scope = await trustScope(ctx.adminTrustId);
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot deactivate your own account.",
        });
      }
      const target = await loadTargetInTrust(input.userId, scope);

      await systemDb.user.update({
        where: { id: target.id },
        data: {
          status: input.status,
          deactivatedAt: input.status === "DEACTIVATED" ? new Date() : null,
        },
      });
      if (input.status === "DEACTIVATED") {
        await systemDb.session.updateMany({
          where: { userId: target.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      const tenantId = auditTenantId(target, scope);
      if (tenantId) {
        await systemDb.auditEvent.create({
          data: {
            tenantId,
            userId: ctx.session.user.id,
            action: "user.status_changed",
            entityType: "user",
            entityId: target.id,
            metadata: { status: input.status, via: "admin-ui" },
          },
        });
      }
      return { ok: true };
    }),
});
