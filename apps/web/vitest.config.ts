import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests use the real local database (same as packages/db).
// Pure unit tests still run if no database is configured — only files
// that touch the DB will fail without one.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.APP_URL ??= "http://localhost:3000";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
