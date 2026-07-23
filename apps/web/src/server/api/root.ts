import { auditRouter } from "@/server/api/routers/audit";
import { authRouter } from "@/server/api/routers/auth";
import { caseworkRouter } from "@/server/api/routers/casework";
import { documentsRouter } from "@/server/api/routers/documents";
import { healthRouter } from "@/server/api/routers/health";
import { overviewRouter } from "@/server/api/routers/overview";
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
  overview: overviewRouter,
  casework: caseworkRouter,
  documents: documentsRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
