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

import type { Prisma, UserRole } from "@prisma/client";

// Atomic multi-statement work under the RLS system context. The per-operation
// clients above wrap each call in its own transaction; use this when several
// writes must land together (e.g. a decision: status transition + decision
// row + audit entry). Callers must verify tenant ownership through a
// tenant-scoped read first — inside here, RLS is the system context.
export async function systemTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.context', 'system', TRUE)`;
    return fn(tx);
  });
}

// ── Tenancy resolution (single school vs Multi-Academy Trust) ───────────────

// The two tenancy modes the product has (spec section 4 / 5.1): a single
// school, or a Multi-Academy Trust with school-level drill-down.
export type TenancyMode = "school" | "mat";

// A school a user is allowed to see. A director gets every school in their
// trust; a DSL gets exactly their own. Callers read each school's pupil data
// through dbForTenant(school.id), so the database's per-school row-level
// security remains the enforcement boundary — this list only decides which
// school contexts a request may open.
export type AccessibleSchool = {
  id: string;
  name: string;
  slug: string;
  trustId: string | null;
};

export type Tenancy = {
  mode: TenancyMode;
  trustId: string | null;
  schools: AccessibleSchool[];
};

// The minimal user shape the resolver needs — kept structural so the web
// session type satisfies it without importing Prisma model types.
export type TenancyUser = {
  role: UserRole;
  tenantId: string | null;
  trustId: string | null;
};

const TENANCY_SCHOOL_SELECT = {
  id: true,
  name: true,
  slug: true,
  trustId: true,
} as const;

// Resolves the set of schools a user may read.
//
// The query goes through systemDb but is strictly filtered by the user's OWN
// tenantId / trustId taken from their authenticated session — a director can
// only ever list schools whose trust_id equals their own trust, and a DSL only
// their own school. There is no path here to another tenant's or trust's
// rows. CTO-DECISION: a dedicated app.trust_id RLS context would push the
// director's "schools of my trust" scope down into the database itself; the
// application-level filter is the simplest working version for the MVP.
export async function resolveAccessibleSchools(
  user: TenancyUser,
): Promise<AccessibleSchool[]> {
  // A director and a trust admin both see every school in their trust.
  if ((user.role === "DIRECTOR" || user.role === "ADMIN") && user.trustId) {
    return systemDb.tenant.findMany({
      where: { trustId: user.trustId },
      orderBy: { name: "asc" },
      select: TENANCY_SCHOOL_SELECT,
    });
  }
  if (user.tenantId) {
    const school = await systemDb.tenant.findUnique({
      where: { id: user.tenantId },
      select: TENANCY_SCHOOL_SELECT,
    });
    return school ? [school] : [];
  }
  return [];
}

// Resolves a user's full tenancy: mode, trust, and accessible schools.
export async function resolveTenancy(user: TenancyUser): Promise<Tenancy> {
  const schools = await resolveAccessibleSchools(user);
  // A director and a trust admin both operate across the whole trust.
  const trustWide =
    (user.role === "DIRECTOR" || user.role === "ADMIN") && !!user.trustId;
  const mode: TenancyMode = trustWide ? "mat" : "school";
  return { mode, trustId: user.trustId, schools };
}

// Customer provisioning + onboarding primitives (commercialisation slice 2):
// provisionCustomer (the silo factory's data layer) and createSchool (shared by
// provisioning and in-app onboarding).
export * from "./provisioning";
