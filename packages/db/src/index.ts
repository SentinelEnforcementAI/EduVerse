import { PrismaClient } from "@prisma/client";

export * from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Singleton so Next.js dev-mode hot reloads don't exhaust the connection pool.
// Every table is protected by default-deny row-level security, so this raw
// client sees nothing on its own — always query through dbForTenant() or
// systemDb below.
const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Wraps every operation in a transaction that first sets the RLS context,
// so the policies in Postgres scope the query. set_config(..., true) is
// transaction-local: nothing leaks onto the pooled connection.
function withRlsContext(setting: "app.tenant_id" | "app.context", value: string) {
  return db.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await db.$transaction([
            db.$executeRaw`SELECT set_config(${setting}, ${value}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

// Client scoped to a single tenant. All reads and writes are constrained to
// that tenant's rows by the database's RLS policies.
export function dbForTenant(tenantId: string) {
  return withRlsContext("app.tenant_id", tenantId);
}

// Cross-tenant client for auth flows and background jobs (RLS system
// context). Never expose this to request handlers that act on behalf of a
// tenant user — use dbForTenant instead.
export const systemDb = withRlsContext("app.context", "system");

export type TenantDb = ReturnType<typeof dbForTenant>;
export type SystemDb = typeof systemDb;
