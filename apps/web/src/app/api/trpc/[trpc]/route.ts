import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { NextRequest } from "next/server";

import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { reportError } from "@/server/observability/report-error";

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    // Every server error flows through the observability seam (slice 8), in all
    // environments — structured, alertable, and the Sentry drop-in point.
    onError: ({ path, error }) => {
      reportError(error, { path: path ?? "<no-path>", code: error.code });
    },
  });

export { handler as GET, handler as POST };
