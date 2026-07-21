import { execSync } from "node:child_process";

export default function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Rules tests need a running Postgres — " +
        "run `docker compose up -d` and ensure .env exists.",
    );
  }
  execSync("pnpm --filter @sentinel/db exec prisma migrate deploy", {
    stdio: "inherit",
    cwd: new URL("../../..", import.meta.url).pathname,
  });
}
