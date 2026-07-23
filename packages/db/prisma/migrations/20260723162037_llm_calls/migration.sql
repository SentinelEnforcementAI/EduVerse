-- CreateTable
CREATE TABLE "llm_calls" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "signal_id" TEXT,
    "prompt_key" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL,
    "input_hash" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "model_id" TEXT,
    "advisory" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_calls_tenant_id_created_at_idx" ON "llm_calls"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "llm_calls_signal_id_created_at_idx" ON "llm_calls"("signal_id", "created_at");


-- ── Row-level security: append-only ─────────────────────────────────────────
ALTER TABLE "llm_calls" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "llm_calls" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "llm_calls" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "llm_calls" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
