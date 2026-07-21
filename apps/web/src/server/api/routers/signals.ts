import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

export const signalsRouter = createTRPCRouter({
  // Counts by status for the caller's school. The full signal surface
  // (flagged pupils, reasoning detail) is build step 6.
  summary: tenantProcedure.query(async ({ ctx }) => {
    const grouped = await ctx.tenantDb.signal.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    const counts = { OPEN: 0, CONFIRMED: 0, DISMISSED: 0, ESCALATED: 0 };
    for (const row of grouped) {
      counts[row.status] = row._count._all;
    }
    return counts;
  }),
});
