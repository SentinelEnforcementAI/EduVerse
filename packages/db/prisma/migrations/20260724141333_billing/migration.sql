-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "per_pupil_pence_per_year" INTEGER NOT NULL DEFAULT 500,
    "mat_fee_pence" INTEGER NOT NULL DEFAULT 5000000,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "stripe_customer_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_snapshots" (
    "id" TEXT NOT NULL,
    "trust_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "pupil_count" INTEGER NOT NULL,
    "per_pupil_pence" INTEGER NOT NULL,
    "mat_fee_pence" INTEGER NOT NULL,
    "usage_pence" INTEGER NOT NULL,
    "total_pence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "invoice_status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "stripe_invoice_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_trust_id_key" ON "billing_accounts"("trust_id");

-- CreateIndex
CREATE INDEX "billing_snapshots_trust_id_period_start_idx" ON "billing_snapshots"("trust_id", "period_start");


-- ── Row-level security: trust-level, system context only ────────────────────
-- Billing is commercial data scoped to a trust, not pupil data. It is reached
-- only by a trust administrator through the system context (the billing router
-- filters by the admin's own trust_id at the application layer); a school
-- tenant context can never see or change it. Under FORCE RLS, only app.is_system()
-- passes. No DELETE policy — billing records are not deleted.
ALTER TABLE "billing_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY system_read ON "billing_accounts"
  FOR SELECT USING (app.is_system());
CREATE POLICY system_insert ON "billing_accounts"
  FOR INSERT WITH CHECK (app.is_system());
CREATE POLICY system_update ON "billing_accounts"
  FOR UPDATE USING (app.is_system()) WITH CHECK (app.is_system());

ALTER TABLE "billing_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_snapshots" FORCE ROW LEVEL SECURITY;
CREATE POLICY system_read ON "billing_snapshots"
  FOR SELECT USING (app.is_system());
CREATE POLICY system_insert ON "billing_snapshots"
  FOR INSERT WITH CHECK (app.is_system());
CREATE POLICY system_update ON "billing_snapshots"
  FOR UPDATE USING (app.is_system()) WITH CHECK (app.is_system());
