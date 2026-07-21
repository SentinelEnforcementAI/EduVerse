import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@sentinel/db"],
};

export default nextConfig;
