-- CreateEnum
CREATE TYPE "RuleExecutionStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('OPEN', 'CONFIRMED', 'DISMISSED', 'ESCALATED');

-- CreateTable
CREATE TABLE "rule_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_executions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "RuleExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "as_of" TIMESTAMP(3) NOT NULL,
    "stats" JSONB,
    "error" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "rule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "rule_version_id" TEXT NOT NULL,
    "execution_id" TEXT NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'OPEN',
    "severity" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "reasoning" JSONB NOT NULL,
    "window_start" DATE NOT NULL,
    "window_end" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rule_versions_key_version_key" ON "rule_versions"("key", "version");

-- CreateIndex
CREATE INDEX "rule_executions_tenant_id_started_at_idx" ON "rule_executions"("tenant_id", "started_at");

-- CreateIndex
CREATE INDEX "signals_tenant_id_status_idx" ON "signals"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "signals_pupil_id_status_idx" ON "signals"("pupil_id", "status");

-- AddForeignKey
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_pupil_id_fkey" FOREIGN KEY ("pupil_id") REFERENCES "pupils"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_rule_version_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signals" ADD CONSTRAINT "signals_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "rule_executions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Row-level security ──────────────────────────────────────────────────────
-- rule_versions: platform-wide definitions (tenant_id NULL) are readable by
-- every tenant context — a school must be able to see the exact rule that
-- produced its signals (explainability). Only the system context writes.
ALTER TABLE "rule_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rule_versions"
  USING (app.is_system() OR "tenant_id" IS NULL OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system());

ALTER TABLE "rule_executions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rule_executions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "rule_executions"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());

ALTER TABLE "signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "signals"
  USING (app.is_system() OR "tenant_id" = app.tenant_id())
  WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
