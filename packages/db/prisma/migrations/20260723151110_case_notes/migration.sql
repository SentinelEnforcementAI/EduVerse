-- CreateTable
CREATE TABLE "case_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "signal_id" TEXT NOT NULL,
    "pupil_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "tagged_user_ids" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_notes_signal_id_created_at_idx" ON "case_notes"("signal_id", "created_at");

-- CreateIndex
CREATE INDEX "case_notes_tenant_id_created_at_idx" ON "case_notes"("tenant_id", "created_at");


-- ── Row-level security: append-only ─────────────────────────────────────────
-- SELECT and INSERT policies only — a safeguarding case note, once written, is
-- part of the record and can never be rewritten or removed (spec principle 3).
ALTER TABLE "case_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "case_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_read ON "case_notes"
  FOR SELECT USING (app.is_system() OR "tenant_id" = app.tenant_id());
CREATE POLICY tenant_insert ON "case_notes"
  FOR INSERT WITH CHECK (app.is_system() OR "tenant_id" = app.tenant_id());
