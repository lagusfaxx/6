-- CreateEnum
CREATE TYPE "ReferralCycleStatus" AS ENUM ('ACTIVE', 'PENDING_PAYMENT', 'PAID', 'EXPIRED');

-- CreateTable
CREATE TABLE "CreatorReferralCode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creatorId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCycle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referralCodeId" UUID NOT NULL,
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "status" "ReferralCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalReferrals" INTEGER NOT NULL DEFAULT 0,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "bonusAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralRedemption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referralCodeId" UUID NOT NULL,
    "cycleId" UUID,
    "professionalId" UUID NOT NULL,
    "amountCLP" INTEGER NOT NULL DEFAULT 10000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CreatorReferralCode_creatorId_key" ON "CreatorReferralCode"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorReferralCode_code_key" ON "CreatorReferralCode"("code");

-- CreateIndex
CREATE INDEX "CreatorReferralCode_code_idx" ON "CreatorReferralCode"("code");

-- CreateIndex
CREATE INDEX "ReferralCycle_referralCodeId_status_idx" ON "ReferralCycle"("referralCodeId", "status");

-- CreateIndex
CREATE INDEX "ReferralCycle_cycleEnd_idx" ON "ReferralCycle"("cycleEnd");

-- CreateIndex
CREATE INDEX "ReferralCycle_status_idx" ON "ReferralCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralRedemption_professionalId_key" ON "ReferralRedemption"("professionalId");

-- CreateIndex
CREATE INDEX "ReferralRedemption_referralCodeId_createdAt_idx" ON "ReferralRedemption"("referralCodeId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralRedemption_cycleId_idx" ON "ReferralRedemption"("cycleId");

-- AddForeignKey
ALTER TABLE "CreatorReferralCode" ADD CONSTRAINT "CreatorReferralCode_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCycle" ADD CONSTRAINT "ReferralCycle_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "CreatorReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "CreatorReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "ReferralCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralRedemption" ADD CONSTRAINT "ReferralRedemption_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
