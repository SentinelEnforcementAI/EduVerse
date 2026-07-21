-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "pupil_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_tenant_id_created_at_idx" ON "audit_events"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_pupil_id_created_at_idx" ON "audit_events"("pupil_id", "created_at");


-- ── Row-level security: append-only ─────────────────────────────────────────
-- Only SELECT and INSERT policies exist. Under FORCE ROW LEVEL SECURITY the
-- absence of UPDATE/DELETE policies means no connection — including the
-- system context — can modify or remove an audit entry. Append-only is a
-- property of the database, not a convention.
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "audit_events"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "audit_events"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
