import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: "./tests/global-setup.ts",
    // Tests share one database; keep files sequential.
    fileParallelism: false,
  },
});
