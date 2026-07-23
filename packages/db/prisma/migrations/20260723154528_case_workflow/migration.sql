-- CreateTable
CREATE TABLE "case_tasks" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "case_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_reviews" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "scheduled_for" TEXT NOT NULL,
    "attendees" TEXT[],
    "note" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_tasks_signal_id_created_at_idx" ON "case_tasks"("signal_id", "created_at");

-- CreateIndex
CREATE INDEX "case_tasks_tenant_id_created_at_idx" ON "case_tasks"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "case_reviews_signal_id_created_at_idx" ON "case_reviews"("signal_id", "created_at");

-- CreateIndex
CREATE INDEX "case_reviews_tenant_id_created_at_idx" ON "case_reviews"("tenant_id", "created_at");


-- ── Row-level security ──────────────────────────────────────────────────────
-- case_tasks: SELECT / INSERT / UPDATE (toggle done); no DELETE.
ALTER TABLE "case_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_tasks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "case_tasks" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "case_tasks" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_update ON "case_tasks" FOR UPDATE USING (app.is_system() OR "tenant_id" = app.tenant_id()) WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());

-- case_reviews: append-only (SELECT / INSERT).
ALTER TABLE "case_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "case_reviews" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "case_reviews" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
