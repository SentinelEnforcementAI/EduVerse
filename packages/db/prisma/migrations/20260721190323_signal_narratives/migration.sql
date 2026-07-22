-- CreateTable
CREATE TABLE "signal_narratives" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "ai_generated" BOOLEAN NOT NULL DEFAULT true,
    "prompt_key" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signal_narratives_signal_id_created_at_idx" ON "signal_narratives"("signal_id", "created_at");

-- CreateIndex
CREATE INDEX "signal_narratives_tenant_id_created_at_idx" ON "signal_narratives"("tenant_id", "created_at");


-- ── Row-level security: append-only ─────────────────────────────────────────
-- SELECT and INSERT policies only — an AI narrative, once shown to a DSL,
-- is part of the record and can never be rewritten or removed.
ALTER TABLE "signal_narratives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signal_narratives" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "signal_narratives"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "signal_narratives"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
