-- CreateEnum
CREATE TYPE "AttendanceSession" AS ENUM ('AM', 'PM');

-- CreateTable
CREATE TABLE "pupils" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "upn" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "year_group" INTEGER NOT NULL,
    "registration_group" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pupils_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "session" "AttendanceSession" NOT NULL,
    "code" TEXT NOT NULL,
    "present" BOOLEAN NOT NULL,
    "authorised" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "behaviour_incidents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "behaviour_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attainment_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "assessed_at" DATE NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attainment_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pupils_upn_key" ON "pupils"("upn");

-- CreateIndex
CREATE INDEX "pupils_tenant_id_idx" ON "pupils"("tenant_id");

-- CreateIndex
CREATE INDEX "pupils_tenant_id_year_group_idx" ON "pupils"("tenant_id", "year_group");

-- CreateIndex
CREATE INDEX "attendance_records_tenant_id_date_idx" ON "attendance_records"("tenant_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_pupil_id_date_session_key" ON "attendance_records"("pupil_id", "date", "session");

-- CreateIndex
CREATE INDEX "behaviour_incidents_tenant_id_date_idx" ON "behaviour_incidents"("tenant_id", "date");

-- CreateIndex
CREATE INDEX "behaviour_incidents_pupil_id_date_idx" ON "behaviour_incidents"("pupil_id", "date");

-- CreateIndex
CREATE INDEX "attainment_records_tenant_id_assessed_at_idx" ON "attainment_records"("tenant_id", "assessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "attainment_records_pupil_id_subject_assessed_at_key" ON "attainment_records"("pupil_id", "subject", "assessed_at");

-- AddForeignKey
ALTER TABLE "pupils" ADD CONSTRAINT "pupils_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behaviour_incidents" ADD CONSTRAINT "behaviour_incidents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behaviour_incidents" ADD CONSTRAINT "behaviour_incidents_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attainment_records" ADD CONSTRAINT "attainment_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attainment_records" ADD CONSTRAINT "attainment_records_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Row-level security ──────────────────────────────────────────────────────
-- Same default-deny model as the tenancy_rls migration. Pupil data always
-- belongs to a tenant (tenant_id NOT NULL), so there is no platform-level
-- special case here.
ALTER TABLE "pupils" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pupils" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "pupils"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());

ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attendance_records"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());

ALTER TABLE "behaviour_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "behaviour_incidents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "behaviour_incidents"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());

ALTER TABLE "attainment_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attainment_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "attainment_records"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
