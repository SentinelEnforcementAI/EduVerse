-- CreateEnum
CREATE TYPE "CaseMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "CaseMessageStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "case_messages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "direction" "CaseMessageDirection" NOT NULL,
    "status" "CaseMessageStatus" NOT NULL DEFAULT 'SENT',
    "comm_type" TEXT,
    "from_address" TEXT NOT NULL,
    "to_addresses" TEXT[],
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_by_id" TEXT,
    "thread_id" TEXT,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_messages_signal_id_created_at_idx" ON "case_messages"("signal_id", "created_at");

-- CreateIndex
CREATE INDEX "case_messages_tenant_id_created_at_idx" ON "case_messages"("tenant_id", "created_at");


-- ── Row-level security: append-only ─────────────────────────────────────────
-- SELECT and INSERT policies only — a safeguarding communication, once sent, is
-- part of the record and can never be rewritten or removed (spec principles 3
-- and 4). Sealed on any list surface at the application layer.
ALTER TABLE "case_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "case_messages"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "case_messages"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
