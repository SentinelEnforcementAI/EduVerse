import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

// Example route proving tRPC is wired end to end (client → server → client
// with full type inference). Kept as a permanent healthcheck.
export const healthRouter = createTRPCRouter({
  ping: publicProcedure
    .input(z.object({ echo: z.string().max(200).optional() }).optional())
    .query(({ input }) => ({
      status: "ok" as const,
      service: "sentinel-watch",
      echo: input?.echo ?? null,
      time: new Date(),
    })),
});
