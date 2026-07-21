import { execSync } from "node:child_process";

// RLS tests run against a real Postgres — that is the point: the policies
// live in the database, so the database is what gets tested.
export default function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. RLS tests need a running Postgres — " +
        "run `docker compose up -d` and ensure .env exists (cp .env.example .env).",
    );
  }
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    cwd: new URL("..", import.meta.url).pathname,
  });
}
