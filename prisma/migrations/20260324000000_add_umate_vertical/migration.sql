-- CreateEnum
CREATE TYPE "UmateCreatorStatus" AS ENUM ('DRAFT', 'PENDING_TERMS', 'PENDING_BANK', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "UmatePlanTier" AS ENUM ('SILVER', 'GOLD', 'DIAMOND');
CREATE TYPE "UmateSubStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "UmatePostVisibility" AS ENUM ('FREE', 'PREMIUM');
CREATE TYPE "UmateLedgerType" AS ENUM ('PLAN_PURCHASE', 'SLOT_ACTIVATION', 'CREATOR_PAYOUT', 'PLATFORM_COMMISSION', 'IVA', 'FLOW_FEE', 'ADJUSTMENT', 'WITHDRAWAL', 'REFUND');

-- AlterEnum
ALTER TYPE "PaymentIntentPurpose" ADD VALUE 'UMATE_PLAN';

-- CreateTable: UmateCreator
CREATE TABLE "UmateCreator" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "coverUrl" TEXT,
    "bankName" TEXT,
    "accountType" TEXT,
    "accountNumber" TEXT,
    "holderName" TEXT,
    "holderRut" TEXT,
    "status" "UmateCreatorStatus" NOT NULL DEFAULT 'DRAFT',
    "termsAcceptedAt" TIMESTAMP(3),
    "rulesAcceptedAt" TIMESTAMP(3),
    "contractAcceptedAt" TIMESTAMP(3),
    "subscriberCount" INTEGER NOT NULL DEFAULT 0,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "totalEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmateCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmatePlan
CREATE TABLE "UmatePlan" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tier" "UmatePlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "priceCLP" INTEGER NOT NULL,
    "maxSlots" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmateSubscription
CREATE TABLE "UmateSubscription" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "status" "UmateSubStatus" NOT NULL DEFAULT 'ACTIVE',
    "slotsTotal" INTEGER NOT NULL,
    "slotsUsed" INTEGER NOT NULL DEFAULT 0,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "paymentIntentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UmateSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmateCreatorSub
CREATE TABLE "UmateCreatorSub" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscriptionId" UUID NOT NULL,
    "subscriberId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmateCreatorSub_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmatePost
CREATE TABLE "UmatePost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creatorId" UUID NOT NULL,
    "caption" TEXT,
    "visibility" "UmatePostVisibility" NOT NULL DEFAULT 'FREE',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmatePost_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmatePostMedia
CREATE TABLE "UmatePostMedia" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "postId" UUID NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "pos" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UmatePostMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmateLike
CREATE TABLE "UmateLike" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UmateLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmateLedgerEntry
CREATE TABLE "UmateLedgerEntry" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creatorId" UUID,
    "type" "UmateLedgerType" NOT NULL,
    "grossAmount" INTEGER NOT NULL DEFAULT 0,
    "ivaAmount" INTEGER NOT NULL DEFAULT 0,
    "flowFee" INTEGER NOT NULL DEFAULT 0,
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "creatorPayout" INTEGER NOT NULL DEFAULT 0,
    "netAmount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "referenceId" UUID,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UmateLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmatePayoutBatch
CREATE TABLE "UmatePayoutBatch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "creatorCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmatePayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UmateWithdrawal
CREATE TABLE "UmateWithdrawal" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creatorId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderRut" TEXT NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmateWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UmateCreator_userId_key" ON "UmateCreator"("userId");
CREATE INDEX "UmateCreator_status_idx" ON "UmateCreator"("status");

CREATE UNIQUE INDEX "UmatePlan_tier_key" ON "UmatePlan"("tier");

CREATE INDEX "UmateSubscription_userId_status_idx" ON "UmateSubscription"("userId", "status");
CREATE INDEX "UmateSubscription_cycleEnd_idx" ON "UmateSubscription"("cycleEnd");

CREATE UNIQUE INDEX "UmateCreatorSub_subscriptionId_creatorId_key" ON "UmateCreatorSub"("subscriptionId", "creatorId");
CREATE INDEX "UmateCreatorSub_subscriberId_expiresAt_idx" ON "UmateCreatorSub"("subscriberId", "expiresAt");
CREATE INDEX "UmateCreatorSub_creatorId_idx" ON "UmateCreatorSub"("creatorId");

CREATE INDEX "UmatePost_creatorId_createdAt_idx" ON "UmatePost"("creatorId", "createdAt");
CREATE INDEX "UmatePost_visibility_createdAt_idx" ON "UmatePost"("visibility", "createdAt");

CREATE INDEX "UmatePostMedia_postId_idx" ON "UmatePostMedia"("postId");

CREATE UNIQUE INDEX "UmateLike_postId_userId_key" ON "UmateLike"("postId", "userId");
CREATE INDEX "UmateLike_userId_idx" ON "UmateLike"("userId");

CREATE INDEX "UmateLedgerEntry_creatorId_createdAt_idx" ON "UmateLedgerEntry"("creatorId", "createdAt");
CREATE INDEX "UmateLedgerEntry_type_createdAt_idx" ON "UmateLedgerEntry"("type", "createdAt");

CREATE INDEX "UmateWithdrawal_creatorId_idx" ON "UmateWithdrawal"("creatorId");
CREATE INDEX "UmateWithdrawal_status_idx" ON "UmateWithdrawal"("status");

-- AddForeignKey
ALTER TABLE "UmateCreator" ADD CONSTRAINT "UmateCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UmateSubscription" ADD CONSTRAINT "UmateSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UmateSubscription" ADD CONSTRAINT "UmateSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "UmatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UmateCreatorSub" ADD CONSTRAINT "UmateCreatorSub_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UmateSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UmateCreatorSub" ADD CONSTRAINT "UmateCreatorSub_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UmateCreatorSub" ADD CONSTRAINT "UmateCreatorSub_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UmateCreator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UmatePost" ADD CONSTRAINT "UmatePost_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UmateCreator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UmatePostMedia" ADD CONSTRAINT "UmatePostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "UmatePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UmateLike" ADD CONSTRAINT "UmateLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "UmatePost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UmateLike" ADD CONSTRAINT "UmateLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UmateLedgerEntry" ADD CONSTRAINT "UmateLedgerEntry_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UmateCreator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default plans
INSERT INTO "UmatePlan" ("id", "tier", "name", "priceCLP", "maxSlots", "isActive", "updatedAt")
VALUES
  (gen_random_uuid(), 'SILVER',  'Silver',  14990, 1, true, now()),
  (gen_random_uuid(), 'GOLD',    'Gold',    24990, 3, true, now()),
  (gen_random_uuid(), 'DIAMOND', 'Diamond', 34990, 5, true, now());

-- Seed default U-Mate config
INSERT INTO "PlatformConfig" ("key", "value", "updatedAt")
VALUES
  ('umate_payout_per_slot', '5000', now()),
  ('umate_platform_commission_pct', '0', now()),
  ('umate_iva_pct', '19', now()),
  ('umate_flow_fee_pct', '3', now())
ON CONFLICT ("key") DO NOTHING;
