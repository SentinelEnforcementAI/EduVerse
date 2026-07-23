-- CreateTable
CREATE TABLE "kcsie_tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "component_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kcsie_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kcsie_evidence" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "component_key" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kcsie_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kcsie_tasks_tenant_id_component_key_idx" ON "kcsie_tasks"("tenant_id", "component_key");

-- CreateIndex
CREATE UNIQUE INDEX "kcsie_evidence_tenant_id_component_key_document_id_key" ON "kcsie_evidence"("tenant_id", "component_key", "document_id");


-- ── Row-level security ──────────────────────────────────────────────────────
-- kcsie_tasks: SELECT / INSERT / UPDATE (toggle); no DELETE.
ALTER TABLE "kcsie_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kcsie_tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "kcsie_tasks" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "kcsie_tasks" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_update ON "kcsie_tasks" FOR UPDATE USING (app.is_system() OR "tenant_id" = app.tenant_id()) WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
-- kcsie_evidence: append-only.
ALTER TABLE "kcsie_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "kcsie_evidence" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "kcsie_evidence" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "kcsie_evidence" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
