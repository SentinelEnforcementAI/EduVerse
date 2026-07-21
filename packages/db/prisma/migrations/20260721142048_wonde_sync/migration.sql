-- CreateEnum
CREATE TYPE "SyncType" AS ENUM ('STUDENTS', 'ATTENDANCE', 'BEHAVIOUR', 'ATTAINMENT');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterTable
ALTER TABLE "attainment_records" ADD COLUMN     "source_id" TEXT;

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "source_id" TEXT;

-- AlterTable
ALTER TABLE "behaviour_incidents" ADD COLUMN     "source_id" TEXT;

-- AlterTable
ALTER TABLE "pupils" ADD COLUMN     "wonde_id" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "wonde_school_id" TEXT;

-- CreateTable
CREATE TABLE "sync_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "SyncType" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'QUEUED',
    "stats" JSONB,
    "error" TEXT,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sync_runs_tenant_id_type_queued_at_idx" ON "sync_runs"("tenant_id", "type", "queued_at");

-- CreateIndex
CREATE UNIQUE INDEX "attainment_records_tenant_id_source_id_key" ON "attainment_records"("tenant_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_tenant_id_source_id_key" ON "attendance_records"("tenant_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "behaviour_incidents_tenant_id_source_id_key" ON "behaviour_incidents"("tenant_id", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "pupils_tenant_id_wonde_id_key" ON "pupils"("tenant_id", "wonde_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_wonde_school_id_key" ON "tenants"("wonde_school_id");

-- AddForeignKey
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Row-level security ──────────────────────────────────────────────────────
-- Sync runs are tenant-scoped: a school sees its own ingestion history only;
-- the workers write via the system context.
ALTER TABLE "sync_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sync_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "sync_runs"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
