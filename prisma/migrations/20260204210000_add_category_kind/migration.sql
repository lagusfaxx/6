-- Ensure enum exists
DO $$
BEGIN
  CREATE TYPE "CategoryKind" AS ENUM ('PROFESSIONAL', 'ESTABLISHMENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add missing column if needed
ALTER TABLE "Category"
  ADD COLUMN IF NOT EXISTS "kind" "CategoryKind" NOT NULL DEFAULT 'PROFESSIONAL';

-- Backfill any NULLs (defensive)
UPDATE "Category" SET "kind" = 'PROFESSIONAL' WHERE "kind" IS NULL;
