-- Pupil safeguarding context + snapshot. Row-level security on "pupils" already
-- applies to every column, so no policy change is needed for new columns.

-- AlterTable
ALTER TABLE "pupils"
  ADD COLUMN "preferred_name" TEXT,
  ADD COLUMN "sex" TEXT,
  ADD COLUMN "admission_date" TIMESTAMP(3),
  ADD COLUMN "house" TEXT,
  ADD COLUMN "first_language" TEXT,
  ADD COLUMN "ethnicity" TEXT,
  ADD COLUMN "pupil_premium" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "free_school_meals" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sen_status" TEXT,
  ADD COLUMN "eal" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "looked_after" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "young_carer" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "service_child" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "medical_needs" TEXT;
