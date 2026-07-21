import type { SyncType } from "@sentinel/db";

import { createTRPCRouter, tenantProcedure } from "@/server/api/trpc";

const SYNC_TYPES: SyncType[] = [
  "STUDENTS",
  "ATTENDANCE",
  "BEHAVIOUR",
  "ATTAINMENT",
];

export const syncRouter = createTRPCRouter({
  // Latest sync run per data type for the caller's school. RLS scopes the
  // rows; a school can only ever see its own ingestion history.
  status: tenantProcedure.query(async ({ ctx }) => {
    const runs = await ctx.tenantDb.syncRun.findMany({
      orderBy: { queuedAt: "desc" },
      take: 50,
    });
    return SYNC_TYPES.map((type) => {
      const latest = runs.find((run) => run.type === type);
      return latest
        ? {
            type,
            status: latest.status,
            queuedAt: latest.queuedAt,
            finishedAt: latest.finishedAt,
            stats: latest.stats,
            error: latest.error,
          }
        : { type, status: null };
    });
  }),
});
