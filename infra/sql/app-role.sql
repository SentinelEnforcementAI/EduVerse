-- Production application role: non-owner, so row-level security never
-- depends on FORCE ROW LEVEL SECURITY alone (resolves the CTO-DECISION in
-- the tenancy migration). Run once as sentinel_owner after the first
-- migration deploy:
--
--   psql "$OWNER_DATABASE_URL" -v app_password='<generated password>' \
--        -f infra/sql/app-role.sql
--
-- Then set the sentinel-watch/database-url-app secret to:
--   postgresql://sentinel_app:<password>@<rds-endpoint>:5432/sentinel_watch

CREATE ROLE sentinel_app LOGIN PASSWORD :'app_password';

GRANT CONNECT ON DATABASE sentinel_watch TO sentinel_app;
GRANT USAGE ON SCHEMA public, app TO sentinel_app;

-- DML only — the app never alters schema. RLS policies (default-deny,
-- tenant_id scoped) still gate every row; this role simply cannot bypass
-- them even in principle, because it owns nothing.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sentinel_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sentinel_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO sentinel_app;

-- Future tables created by migrations (which run as sentinel_owner) inherit
-- the same grants automatically.
ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sentinel_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO sentinel_app;
ALTER DEFAULT PRIVILEGES FOR ROLE sentinel_owner IN SCHEMA app
  GRANT EXECUTE ON FUNCTIONS TO sentinel_app;
