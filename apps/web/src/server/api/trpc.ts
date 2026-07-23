import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import {
  dbForTenant,
  resolveTenancy,
  systemDb,
  type SystemDb,
  type Tenancy,
  type TenantDb,
} from "@sentinel/db";

import { getAuthSession, type AuthSession } from "@/server/auth/session";

// Context available to every procedure. Built once per request.
//
// db is the RLS system context — reserved for auth flows. Anything acting on
// behalf of a signed-in tenant user must go through tenantDb, which Postgres
// row-level security constrains to that user's tenant.
//
// tenancy resolves the caller's mode (single school vs MAT) and the schools
// they may read. A school DSL also gets tenantId / tenantDb for the existing
// single-school routes; a trust director has neither (tenantId is null) and
// reads each school through dbForSchool() below.
export type TRPCContext = {
  db: SystemDb;
  session: AuthSession | null;
  tenantId: string | null;
  tenantDb: TenantDb | null;
  tenancy: Tenancy | null;
  headers: Headers;
};

export async function createTRPCContext(opts: {
  headers: Headers;
}): Promise<TRPCContext> {
  const session = await getAuthSession();
  const tenantId = session?.user.tenantId ?? null;
  const tenancy = session ? await resolveTenancy(session.user) : null;
  return {
    db: systemDb,
    session,
    tenantId,
    tenantDb: tenantId ? dbForTenant(tenantId) : null,
    tenancy,
    headers: opts.headers,
  };
}

type FlattenedZodError = {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
};

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError
            ? (error.cause.flatten() as FlattenedZodError)
            : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

export const publicProcedure = t.procedure;

// Requires a signed-in user; narrows ctx.session to non-null for handlers.
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

// Requires a signed-in user attached to a tenant. Handlers get tenantDb,
// which the database's RLS policies scope to that tenant — cross-tenant reads
// and writes are impossible at the DB layer, not just filtered in app code.
export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenantId || !ctx.tenantDb) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is not attached to a school yet.",
    });
  }
  return next({
    ctx: { ...ctx, tenantId: ctx.tenantId, tenantDb: ctx.tenantDb },
  });
});

// Requires a signed-in user with a resolved tenancy that grants access to at
// least one school — a school DSL or a trust director. Narrows ctx.tenancy to
// non-null for handlers. Use this for tenancy-aware surfaces (overviews) that
// serve both modes.
export const tenancyProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.tenancy || ctx.tenancy.schools.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your account is not attached to a school or trust yet.",
    });
  }
  return next({ ctx: { ...ctx, tenancy: ctx.tenancy } });
});

// Opens a tenant-scoped client for one school the caller is allowed to see.
// The school must be in the caller's resolved tenancy — a director can only
// reach schools of their own trust, a DSL only their own school — so this is
// the single RLS-safe entry point for both modes. Returns the school and a
// client whose every query Postgres constrains to that school.
export function dbForSchool(tenancy: Tenancy, schoolId: string) {
  const school = tenancy.schools.find((s) => s.id === schoolId);
  if (!school) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to that school.",
    });
  }
  return { school, db: dbForTenant(school.id) };
}
