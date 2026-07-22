import { systemDb } from "../src";

// Creates (or re-passwords) the non-owner application role in production.
// Runs as a one-off ECS task with the OWNER connection string; the password
// arrives via APP_ROLE_PASSWORD. Idempotent — safe to re-run.
//
// Mirrors infra/sql/app-role.sql; kept as a script so the bootstrap
// workflow can run it inside the VPC without a psql client.
async function main() {
  const password = process.env.APP_ROLE_PASSWORD;
  if (!password || password.length < 16) {
    throw new Error("APP_ROLE_PASSWORD (>=16 chars) is required");
  }
  // Role names are fixed identifiers; the password is the only interpolated
  // value and single quotes are escaped for the SQL literal.
  const quoted = password.replace(/'/g, "''");

  const statements = [
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sentinel_app') THEN
         CREATE ROLE sentinel_app LOGIN PASSWORD '${quoted}';
       ELSE
         ALTER ROLE sentinel_app WITH LOGIN PASSWORD '${quoted}';
       END IF;
     END $$;`,
    `GRANT CONNECT ON DATABASE sentinel_watch TO sentinel_app;`,
    `GRANT USAGE ON SCHEMA public, app TO sentinel_app;`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sentinel_app;`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sentinel_app;`,
    `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO sentinel_app;`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_owner IN SCHEMA public
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sentinel_app;`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_owner IN SCHEMA public
       GRANT USAGE, SELECT ON SEQUENCES TO sentinel_app;`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_owner IN SCHEMA app
       GRANT EXECUTE ON FUNCTIONS TO sentinel_app;`,
  ];

  for (const sql of statements) {
    await systemDb.$executeRawUnsafe(sql);
  }
  console.info("sentinel_app role ready (created or re-passworded).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => systemDb.$disconnect());
