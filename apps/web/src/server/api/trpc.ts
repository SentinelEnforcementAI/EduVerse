import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import {
  dbForTenant,
  systemDb,
  type SystemDb,
  type TenantDb,
} from "@sentinel/db";

import { getAuthSession, type AuthSession } from "@/server/auth/session";

// Context available to every procedure. Built once per request.
//
// db is the RLS system context — reserved for auth flows. Anything acting on
// behalf of a signed-in tenant user must go through tenantDb, which Postgres
// row-level security constrains to that user's tenant.
export type TRPCContext = {
  db: SystemDb;
  session: AuthSession | null;
  tenantId: string | null;
  tenantDb: TenantDb | null;
  headers: Headers;
};

export async function createTRPCContext(opts: {
  headers: Headers;
}): Promise<TRPCContext> {
  const session = await getAuthSession();
  const tenantId = session?.user.tenantId ?? null;
  return {
    db: systemDb,
    session,
    tenantId,
    tenantDb: tenantId ? dbForTenant(tenantId) : null,
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
