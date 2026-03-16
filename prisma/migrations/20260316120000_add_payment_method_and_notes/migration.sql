-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FLOW', 'TRANSFER');

-- AlterTable
ALTER TABLE "PaymentIntent"
  ADD COLUMN "method"     "PaymentMethod" NOT NULL DEFAULT 'FLOW',
  ADD COLUMN "notes"      TEXT,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3);
