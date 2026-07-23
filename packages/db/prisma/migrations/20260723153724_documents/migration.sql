-- CreateEnum
CREATE TYPE "DocumentScope" AS ENUM ('ORG', 'CASE');

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "scope" "DocumentScope" NOT NULL,
    "signal_id" TEXT,
    "pupil_id" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "doc_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Filed',
    "themes" TEXT[],
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_tenant_id_scope_doc_date_idx" ON "documents"("tenant_id", "scope", "doc_date");

-- CreateIndex
CREATE INDEX "documents_signal_id_created_at_idx" ON "documents"("signal_id", "created_at");


-- ── Row-level security: tenant-scoped, no hard delete ───────────────────────
-- SELECT / INSERT / UPDATE only (no DELETE policy) — a safeguarding document
-- is never removed, only superseded by status (spec principle 3).
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "documents" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "documents"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "documents"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_update ON "documents"
  FOR UPDATE USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
