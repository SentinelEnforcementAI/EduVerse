import { auditRouter } from "@/server/api/routers/audit";
import { authRouter } from "@/server/api/routers/auth";
import { healthRouter } from "@/server/api/routers/health";
import { signalsRouter } from "@/server/api/routers/signals";
import { syncRouter } from "@/server/api/routers/sync";
import { tenantRouter } from "@/server/api/routers/tenant";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

export const appRouter = createTRPCRouter({
  health: healthRouter,
  auth: authRouter,
  tenant: tenantRouter,
  sync: syncRouter,
  signals: signalsRouter,
  audit: auditRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
