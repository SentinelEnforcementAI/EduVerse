-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DSL', 'DIRECTOR');

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "trust_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'DSL',
ADD COLUMN     "trust_id" TEXT;

-- CreateTable
CREATE TABLE "trusts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trusts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trusts_slug_key" ON "trusts"("slug");

-- CreateIndex
CREATE INDEX "users_trust_id_idx" ON "users"("trust_id");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_trust_id_fkey" FOREIGN KEY ("trust_id") REFERENCES "trusts"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Row-level security: trusts ──────────────────────────────────────────────
-- A trust holds no pupil data — every child's record still lives under a
-- school (tenant_id), so the existing default-deny isolation on every data
-- table is untouched by MAT tenancy. The trusts table itself is gated so a
-- school's tenant context may read only the one trust it belongs to (for the
-- header's trust name), and only the system context may write.
--
-- A trust-level user (a director) has no single tenant context; they read
-- each of their trust's schools through that school's own app.tenant_id
-- context (see resolveAccessibleSchools in @sentinel/db), never a cross-tenant
-- path. CTO-DECISION: a dedicated app.trust_id RLS context would enforce the
-- "schools of my trust" scope in the database rather than in application code;
-- the per-school fan-out is the simplest working version for the MVP.
ALTER TABLE "trusts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "trusts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "trusts"
  USING (
    app.is_system()
    OR id IN (
      SELECT "trust_id" FROM "tenants"
      WHERE id = app.tenant_id() AND "trust_id" IS NOT NULL
    )
  )
  WITH CHECK (app.is_system());
