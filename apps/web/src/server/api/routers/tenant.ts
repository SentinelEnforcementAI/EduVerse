import { TRPCError } from "@trpc/server";

import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

export const tenantRouter = createTRPCRouter({
  // The signed-in user's school (or trust). Goes through tenantDb, so RLS
  // guarantees the row returned belongs to the caller's tenant.
  current: tenantProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.tenantDb.tenant.findUnique({
      where: { id: ctx.tenantId },
    });
    if (!tenant) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    return { id: tenant.id, name: tenant.name, slug: tenant.slug };
  }),
});
