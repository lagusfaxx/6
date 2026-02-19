CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Add enums
CREATE TYPE "ProfileType" AS ENUM ('VIEWER', 'CREATOR', 'PROFESSIONAL', 'SHOP');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "PreferenceGender" AS ENUM ('MALE', 'FEMALE', 'ALL', 'OTHER');

-- Extend User profile
ALTER TABLE "User"
  ADD COLUMN "username" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "preferenceGender" "PreferenceGender",
  ADD COLUMN "profileType" "ProfileType" NOT NULL DEFAULT 'VIEWER',
  ADD COLUMN "address" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "latitude" DOUBLE PRECISION,
  ADD COLUMN "longitude" DOUBLE PRECISION,
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "serviceCategory" TEXT,
  ADD COLUMN "serviceDescription" TEXT,
  ADD COLUMN "shopTrialEndsAt" TIMESTAMP(3),
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

UPDATE "User"
SET "username" = COALESCE("username", CONCAT('user_', SUBSTRING(MD5(RANDOM()::text), 1, 8)))
WHERE "username" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Posts price
ALTER TABLE "Post"
  ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;

-- Payments link to subscriptions
ALTER TABLE "Payment"
  ADD COLUMN "subscriptionId" UUID;

-- Subscription table
CREATE TABLE "KhipuSubscription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "redirectUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KhipuSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KhipuSubscription_subscriptionId_key" ON "KhipuSubscription"("subscriptionId");

ALTER TABLE "KhipuSubscription"
  ADD CONSTRAINT "KhipuSubscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "KhipuSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Services
CREATE TABLE "ServiceItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ownerId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "price" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ServiceItem"
  ADD CONSTRAINT "ServiceItem_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Messages
CREATE TABLE "Message" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "fromId" UUID NOT NULL,
  "toId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),

  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_fromId_fkey"
  FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD CONSTRAINT "Message_toId_fkey"
  FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ratings (no comments)
CREATE TABLE "ServiceRating" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "profileId" UUID NOT NULL,
  "raterId" UUID NOT NULL,
  "rating" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceRating_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceRating_profileId_raterId_key" ON "ServiceRating"("profileId", "raterId");

ALTER TABLE "ServiceRating"
  ADD CONSTRAINT "ServiceRating_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRating"
  ADD CONSTRAINT "ServiceRating_raterId_fkey"
  FOREIGN KEY ("raterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
