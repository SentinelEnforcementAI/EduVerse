import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sentinel/db"],
  // Standalone output for the container image (infra/): the build traces
  // exactly the files the server needs, monorepo root included so the
  // Prisma engines come along.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
