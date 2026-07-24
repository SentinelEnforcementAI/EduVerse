import { adminRouter } from "@/server/api/routers/admin";
import { auditRouter } from "@/server/api/routers/audit";
import { authRouter } from "@/server/api/routers/auth";
import { caseworkRouter } from "@/server/api/routers/casework";
import { cohortRouter } from "@/server/api/routers/cohort";
import { documentsRouter } from "@/server/api/routers/documents";
import { healthRouter } from "@/server/api/routers/health";
import { inspectionRouter } from "@/server/api/routers/inspection";
import { kcsieRouter } from "@/server/api/routers/kcsie";
import { overviewRouter } from "@/server/api/routers/overview";
import { readerRouter } from "@/server/api/routers/reader";
import { searchRouter } from "@/server/api/routers/search";
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
  reader: readerRouter,
  kcsie: kcsieRouter,
  inspection: inspectionRouter,
  cohort: cohortRouter,
  search: searchRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
