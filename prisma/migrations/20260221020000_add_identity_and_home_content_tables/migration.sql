-- Add profile identity fields to User and create home content tables.

DO $$ BEGIN
  CREATE TYPE "IdentityType" AS ENUM ('MUJER', 'HOMBRE', 'TRANS', 'PAREJA');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgeCategory" AS ENUM ('AGE_18_25', 'AGE_26_35', 'AGE_36_45', 'AGE_45_PLUS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationLevel" AS ENUM ('BASIC', 'DOCUMENT', 'VIDEO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "identityType" "IdentityType",
  ADD COLUMN IF NOT EXISTS "ageCategory" "AgeCategory",
  ADD COLUMN IF NOT EXISTS "styleTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "offeredServices" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "verificationLevel" "VerificationLevel";

CREATE TABLE IF NOT EXISTS "Story" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "professionalId" uuid NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "caption" TEXT,
  "isApproved" BOOLEAN NOT NULL DEFAULT false,
  "expiresAt" timestamp(3) NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Story_professionalId_idx" ON "Story" ("professionalId");
CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story" ("expiresAt");

DO $$ BEGIN
  ALTER TABLE "Story" ADD CONSTRAINT "Story_professionalId_fkey"
    FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AdSlot" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "position" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "linkUrl" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "tierTarget" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AdSlotEvent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "adSlotId" uuid NOT NULL,
  "eventType" TEXT NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdSlotEvent_adSlotId_idx" ON "AdSlotEvent" ("adSlotId");
CREATE INDEX IF NOT EXISTS "AdSlotEvent_eventType_idx" ON "AdSlotEvent" ("eventType");

DO $$ BEGIN
  ALTER TABLE "AdSlotEvent" ADD CONSTRAINT "AdSlotEvent_adSlotId_fkey"
    FOREIGN KEY ("adSlotId") REFERENCES "AdSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
