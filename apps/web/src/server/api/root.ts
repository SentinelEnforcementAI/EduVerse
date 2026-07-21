import { authRouter } from "@/server/api/routers/auth";
import { healthRouter } from "@/server/api/routers/health";
import { tenantRouter } from "@/server/api/routers/tenant";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
