-- CreateEnum
CREATE TYPE "IntakeStatus" AS ENUM ('PENDING', 'ASSIGNED', 'DISMISSED');

-- CreateTable
CREATE TABLE "intake_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "thread_id" TEXT,
    "provider_message_id" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL,
    "status" "IntakeStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_signal_id" TEXT,
    "assigned_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "intake_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "intake_items_provider_message_id_key" ON "intake_items"("provider_message_id");

-- CreateIndex
CREATE INDEX "intake_items_tenant_id_status_received_at_idx" ON "intake_items"("tenant_id", "status", "received_at");


-- ── Row-level security: tenant-isolated ─────────────────────────────────────
-- Inbound intake is per-school pupil-adjacent data. SELECT/INSERT/UPDATE within
-- the tenant (a DSL triages: assign to a case or dismiss — a status change, not
-- a delete). No DELETE policy: an intake item is part of the safeguarding record.
ALTER TABLE "intake_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "intake_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "intake_items"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "intake_items"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_update ON "intake_items"
  FOR UPDATE USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
