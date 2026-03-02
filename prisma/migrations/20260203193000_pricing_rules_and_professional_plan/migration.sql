-- Add PROFESSIONAL_PLAN to PaymentIntentPurpose enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'PaymentIntentPurpose' AND e.enumlabel = 'PROFESSIONAL_PLAN'
  ) THEN
    ALTER TYPE "PaymentIntentPurpose" ADD VALUE 'PROFESSIONAL_PLAN';
  END IF;
END $$;

-- Create PricingKind enum if it doesn't exist (Prisma will manage this on fresh db)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PricingKind') THEN
    CREATE TYPE "PricingKind" AS ENUM ('PROFESSIONAL', 'SHOP');
  END IF;
END $$;

-- Create PricingRule table
CREATE TABLE IF NOT EXISTS "PricingRule" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kind" "PricingKind" NOT NULL,
  "tier" "ProfessionalTier",
  "priceClp" integer NOT NULL,
  "days" integer NOT NULL DEFAULT 30,
  "isActive" boolean NOT NULL DEFAULT true,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "PricingRule_kind_idx" ON "PricingRule" ("kind");
CREATE INDEX IF NOT EXISTS "PricingRule_kind_tier_idx" ON "PricingRule" ("kind","tier");
