-- AlterEnum: add TOKEN_PURCHASE to PaymentIntentPurpose
ALTER TYPE "PaymentIntentPurpose" ADD VALUE 'TOKEN_PURCHASE';

-- AlterTable: make receiptUrl nullable, add method and paymentIntentId to TokenDeposit
ALTER TABLE "TokenDeposit" ALTER COLUMN "receiptUrl" DROP NOT NULL;
ALTER TABLE "TokenDeposit" ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'TRANSFER';
ALTER TABLE "TokenDeposit" ADD COLUMN "paymentIntentId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "TokenDeposit_paymentIntentId_key" ON "TokenDeposit"("paymentIntentId");
