-- Portal profile fields for category/services/gender-age/geography
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "categoryLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "servicesTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "genderIdentity" TEXT,
  ADD COLUMN IF NOT EXISTS "age" INTEGER,
  ADD COLUMN IF NOT EXISTS "comuna" TEXT,
  ADD COLUMN IF NOT EXISTS "region" TEXT;
