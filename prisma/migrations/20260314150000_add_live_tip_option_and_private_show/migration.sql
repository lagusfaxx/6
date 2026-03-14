-- AlterEnum
ALTER TYPE "TokenTxType" ADD VALUE 'TIP';
ALTER TYPE "TokenTxType" ADD VALUE 'PRIVATE_SHOW';

-- CreateTable
CREATE TABLE "LiveTip" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "streamId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "receiverId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "message" TEXT,
    "optionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTipOption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "streamId" UUID,
    "hostId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "emoji" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTipOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateShow" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "streamId" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "PrivateShow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveTip_streamId_createdAt_idx" ON "LiveTip"("streamId", "createdAt");
CREATE INDEX "LiveTip_senderId_idx" ON "LiveTip"("senderId");
CREATE INDEX "LiveTip_receiverId_idx" ON "LiveTip"("receiverId");

-- CreateIndex
CREATE INDEX "LiveTipOption_hostId_idx" ON "LiveTipOption"("hostId");

-- CreateIndex
CREATE INDEX "PrivateShow_streamId_idx" ON "PrivateShow"("streamId");
CREATE INDEX "PrivateShow_buyerId_idx" ON "PrivateShow"("buyerId");

-- AddForeignKey
ALTER TABLE "LiveTip" ADD CONSTRAINT "LiveTip_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTip" ADD CONSTRAINT "LiveTip_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "LiveTipOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTipOption" ADD CONSTRAINT "LiveTipOption_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateShow" ADD CONSTRAINT "PrivateShow_streamId_fkey" FOREIGN KEY ("streamId") REFERENCES "LiveStream"("id") ON DELETE CASCADE ON UPDATE CASCADE;
