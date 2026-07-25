-- CreateTable
CREATE TABLE "rule_configs" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "rule_key" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "updated_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rule_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rule_configs_trust_id_rule_key_key" ON "rule_configs"("trust_id", "rule_key");


-- ── Row-level security: trust-level, system context only ────────────────────
-- Per-trust rule tuning is configuration, not pupil data. It is written by the
-- rules admin router and read by the engine, both under the system context; a
-- school tenant can never see or change it. No DELETE policy — "reset to
-- defaults" clears the params in place rather than deleting the row.
ALTER TABLE "rule_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY system_read ON "rule_configs"
  FOR SELECT USING (app.is_system());
CREATE POLICY system_insert ON "rule_configs"
  FOR INSERT WITH CHECK (app.is_system());
CREATE POLICY system_update ON "rule_configs"
  FOR UPDATE USING (app.is_system()) WITH CHECK (app.is_system());
