-- U-Mate: per-creator direct subscription (OnlyFans-style PAC recurring)

-- Add per-creator monthly price
ALTER TABLE "UmateCreator" ADD COLUMN "monthlyPriceCLP" INTEGER NOT NULL DEFAULT 9990;

-- Enum for direct subscription status
CREATE TYPE "UmateDirectSubStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

-- Direct subscription table
CREATE TABLE "UmateDirectSubscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "priceCLP" INTEGER NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardHolderName" TEXT,
    "pacMandateId" TEXT,
    "paymentIntentId" UUID,
    "status" "UmateDirectSubStatus" NOT NULL DEFAULT 'ACTIVE',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmateDirectSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UmateDirectSubscription_userId_creatorId_key" ON "UmateDirectSubscription"("userId", "creatorId");
CREATE INDEX "UmateDirectSubscription_userId_status_idx" ON "UmateDirectSubscription"("userId", "status");
CREATE INDEX "UmateDirectSubscription_creatorId_status_idx" ON "UmateDirectSubscription"("creatorId", "status");
CREATE INDEX "UmateDirectSubscription_currentPeriodEnd_idx" ON "UmateDirectSubscription"("currentPeriodEnd");

ALTER TABLE "UmateDirectSubscription" ADD CONSTRAINT "UmateDirectSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UmateDirectSubscription" ADD CONSTRAINT "UmateDirectSubscription_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "UmateCreator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
