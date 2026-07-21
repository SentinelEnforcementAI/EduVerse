import { headers } from "next/headers";

import { createCaller } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";

// Server-side caller for React Server Components: same procedures, same
// auth, same auditing as the HTTP API — one code path for reads.
export async function serverApi() {
  const requestHeaders = new Headers(await headers());
  const ctx = await createTRPCContext({ headers: requestHeaders });
  return createCaller(ctx);
}
