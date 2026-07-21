-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Row-level security ──────────────────────────────────────────────────────
-- Default-deny tenant isolation, enforced in the database (not application
-- code). A connection sees nothing unless the transaction has set either:
--   app.tenant_id — scoped to one tenant's rows (dbForTenant in @sentinel/db)
--   app.context = 'system' — auth flows and background jobs (systemDb)
-- FORCE ROW LEVEL SECURITY applies the policies even to the table owner,
-- which is the role the application connects as.
-- CTO-DECISION: production should additionally use a dedicated non-owner
-- application role so RLS does not depend on FORCE alone.

CREATE SCHEMA IF NOT EXISTS app;

CREATE FUNCTION app.is_system() RETURNS boolean AS $$
  SELECT current_setting('app.context', true) = 'system'
$$ LANGUAGE sql STABLE;

CREATE FUNCTION app.tenant_id() RETURNS text AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')
$$ LANGUAGE sql STABLE;

-- tenants: a tenant context may read its own row; only system may write.
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenants" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenants"
  USING (app.is_system() OR id = app.tenant_id())
  WITH CHECK (app.is_system());

-- Tenant-scoped tables: rows visible/writable only within the matching tenant
-- context. Rows with NULL tenant_id (platform-level) are system-only.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "users"
  USING (app.is_system() OR ("tenant_id" IS NOT NULL AND "tenant_id" = app.tenant_id()))
  WITH CHECK (app.is_system() OR ("tenant_id" IS NOT NULL AND "tenant_id" = app.tenant_id()));

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sessions"
  USING (app.is_system() OR ("tenant_id" IS NOT NULL AND "tenant_id" = app.tenant_id()))
  WITH CHECK (app.is_system() OR ("tenant_id" IS NOT NULL AND "tenant_id" = app.tenant_id()));

ALTER TABLE "magic_link_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "magic_link_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "magic_link_tokens"
  USING (app.is_system() OR ("tenant_id" IS NOT NULL AND "tenant_id" = app.tenant_id()))
  WITH CHECK (app.is_system() OR ("tenant_id" IS NOT NULL AND "tenant_id" = app.tenant_id()));
