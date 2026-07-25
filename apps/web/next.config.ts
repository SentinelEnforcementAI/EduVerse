import path from "node:path";

import type { NextConfig } from "next";

import { securityHeaders } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  transpilePackages: ["@sentinel/db"],
  // Standalone output for the container image (infra/): the build traces
  // exactly the files the server needs, monorepo root included so the
  // Prisma engines come along.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Security response headers on every route (slice 8: production hardening).
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
