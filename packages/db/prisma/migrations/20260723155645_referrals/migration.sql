-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'submitted',
    "decision" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "referral_id" TEXT NOT NULL,
    "occurred_on" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referrals_signal_id_key" ON "referrals"("signal_id");

-- CreateIndex
CREATE INDEX "referrals_tenant_id_created_at_idx" ON "referrals"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "referral_events_referral_id_created_at_idx" ON "referral_events"("referral_id", "created_at");


-- ── Row-level security ──────────────────────────────────────────────────────
-- referrals: SELECT / INSERT / UPDATE (stage advances); no DELETE.
ALTER TABLE "referrals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referrals" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "referrals" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "referrals" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_update ON "referrals" FOR UPDATE USING (app.is_system() OR "tenant_id" = app.tenant_id()) WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
-- referral_events: append-only.
ALTER TABLE "referral_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "referral_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "referral_events" FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "referral_events" FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
