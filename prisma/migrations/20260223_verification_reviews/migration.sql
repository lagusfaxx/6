-- Add verification fields to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verifiedByPhone" TEXT;

-- Set existing profiles as verified (backwards compatible)
UPDATE "User" SET "isVerified" = true WHERE "profileType" IN ('PROFESSIONAL', 'ESTABLISHMENT', 'SHOP') AND "isActive" = true;
UPDATE "User" SET "isVerified" = true WHERE "profileType" IN ('CLIENT', 'VIEWER', 'CREATOR');

-- ProfileReviewSurvey (mini-survey rating system)
CREATE TABLE IF NOT EXISTS "ProfileReviewSurvey" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "profileId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "ratingBody" INTEGER NOT NULL,
    "ratingFace" INTEGER NOT NULL,
    "ratingPhotos" INTEGER NOT NULL,
    "ratingService" INTEGER NOT NULL,
    "ratingVibe" INTEGER NOT NULL,
    "comment" TEXT,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileReviewSurvey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileReviewSurvey_profileId_reviewerId_key" ON "ProfileReviewSurvey"("profileId", "reviewerId");
CREATE INDEX IF NOT EXISTS "ProfileReviewSurvey_profileId_idx" ON "ProfileReviewSurvey"("profileId");

ALTER TABLE "ProfileReviewSurvey" ADD CONSTRAINT "ProfileReviewSurvey_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileReviewSurvey" ADD CONSTRAINT "ProfileReviewSurvey_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
