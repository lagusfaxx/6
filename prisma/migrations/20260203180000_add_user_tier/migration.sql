DO $$
BEGIN
  CREATE TYPE "ProfessionalTier" AS ENUM ('PREMIUM', 'GOLD', 'SILVER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tier" "ProfessionalTier";
