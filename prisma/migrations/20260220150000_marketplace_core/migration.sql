-- Enums
DO $$ BEGIN
  CREATE TYPE "PlanTier" AS ENUM ('SILVER', 'GOLD', 'PLATINUM');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'BANNED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "AdPlacement" AS ENUM ('RIGHT_VERTICAL', 'BOTTOM_HORIZONTAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ProfileAttributeType" AS ENUM ('GENDER_GROUP', 'SERVICE_TAG', 'FEATURE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "StoryMediaType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM ('VISIBLE', 'HIDDEN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- User expansions
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "planTier" "PlanTier" NOT NULL DEFAULT 'SILVER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "moderationReason" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAvailableNow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAvailableNowUpdatedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "termsAcceptedVersion" TEXT;

-- Profile attributes
CREATE TABLE IF NOT EXISTS "ProfileAttribute" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "type" "ProfileAttributeType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileAttribute_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileAttribute_slug_key" ON "ProfileAttribute"("slug");

CREATE TABLE IF NOT EXISTS "ProfileAttributeOnProfile" (
  "profileId" UUID NOT NULL,
  "attributeId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProfileAttributeOnProfile_pkey" PRIMARY KEY ("profileId", "attributeId")
);

CREATE INDEX IF NOT EXISTS "ProfileAttributeOnProfile_attributeId_idx" ON "ProfileAttributeOnProfile"("attributeId");
ALTER TABLE "ProfileAttributeOnProfile" DROP CONSTRAINT IF EXISTS "ProfileAttributeOnProfile_profileId_fkey";
ALTER TABLE "ProfileAttributeOnProfile" ADD CONSTRAINT "ProfileAttributeOnProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileAttributeOnProfile" DROP CONSTRAINT IF EXISTS "ProfileAttributeOnProfile_attributeId_fkey";
ALTER TABLE "ProfileAttributeOnProfile" ADD CONSTRAINT "ProfileAttributeOnProfile_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "ProfileAttribute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ads
CREATE TABLE IF NOT EXISTS "Ad" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "placement" "AdPlacement" NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "linkUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "startAt" TIMESTAMP(3),
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- Stories
CREATE TABLE IF NOT EXISTS "Story" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "mediaUrl" TEXT NOT NULL,
  "mediaType" "StoryMediaType" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Story_profileId_idx" ON "Story"("profileId");
CREATE INDEX IF NOT EXISTS "Story_expiresAt_idx" ON "Story"("expiresAt");
ALTER TABLE "Story" DROP CONSTRAINT IF EXISTS "Story_profileId_fkey";
ALTER TABLE "Story" ADD CONSTRAINT "Story_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "StoryView" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "storyId" UUID NOT NULL,
  "viewerId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StoryView_storyId_idx" ON "StoryView"("storyId");
CREATE INDEX IF NOT EXISTS "StoryView_viewerId_idx" ON "StoryView"("viewerId");
ALTER TABLE "StoryView" DROP CONSTRAINT IF EXISTS "StoryView_storyId_fkey";
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryView" DROP CONSTRAINT IF EXISTS "StoryView_viewerId_fkey";
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reviews
CREATE TABLE IF NOT EXISTS "Review" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "authorId" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "status" "ReviewStatus" NOT NULL DEFAULT 'VISIBLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Review_authorId_profileId_key" ON "Review"("authorId", "profileId");
CREATE INDEX IF NOT EXISTS "Review_profileId_status_idx" ON "Review"("profileId", "status");
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_authorId_fkey";
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" DROP CONSTRAINT IF EXISTS "Review_profileId_fkey";
ALTER TABLE "Review" ADD CONSTRAINT "Review_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Terms
CREATE TABLE IF NOT EXISTS "TermsVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version" TEXT NOT NULL,
  "pdfUrl" TEXT,
  "contentUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TermsVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TermsVersion_version_key" ON "TermsVersion"("version");

ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "iconName" TEXT;
