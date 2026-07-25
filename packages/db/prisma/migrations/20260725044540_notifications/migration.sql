-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'SENT',
    "to_address" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_tenant_id_created_at_idx" ON "notifications"("tenant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_signal_id_user_id_channel_key" ON "notifications"("signal_id", "user_id", "channel");


-- ── Row-level security: append-only ─────────────────────────────────────────
-- SELECT and INSERT policies only — a proactive alert, once sent, is part of
-- the record and can never be rewritten or removed (spec principles 3 and 4).
-- Sealed at the application layer; the alert body never carries a pupil name.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "notifications"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "notifications"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
