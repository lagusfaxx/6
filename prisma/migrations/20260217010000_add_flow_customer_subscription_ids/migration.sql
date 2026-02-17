-- AlterTable
ALTER TABLE "User" ADD COLUMN "flowCustomerId" TEXT,
ADD COLUMN "flowSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_flowCustomerId_key" ON "User"("flowCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_flowSubscriptionId_key" ON "User"("flowSubscriptionId");
