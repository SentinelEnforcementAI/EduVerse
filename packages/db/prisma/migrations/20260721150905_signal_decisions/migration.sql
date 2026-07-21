-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('CONFIRM', 'DISMISS', 'ESCALATE');

-- CreateTable
CREATE TABLE "signal_decisions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "DecisionKind" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signal_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signal_decisions_tenant_id_created_at_idx" ON "signal_decisions"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "signal_decisions_signal_id_idx" ON "signal_decisions"("signal_id");

-- CreateIndex
CREATE INDEX "signal_decisions_pupil_id_created_at_idx" ON "signal_decisions"("pupil_id", "created_at");


-- ── Row-level security: append-only ─────────────────────────────────────────
-- SELECT and INSERT policies only — decisions can never be updated or
-- deleted by any connection, including the system context.
ALTER TABLE "signal_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signal_decisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "signal_decisions"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "signal_decisions"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
