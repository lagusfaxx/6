-- AlterTable: Fix KhipuSubscription field names to match original migration
-- The table already exists with subscriptionId and redirectUrl from migration 0002
-- We just need to add missing fields and update defaults

-- Add amount field with default if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='KhipuSubscription' AND column_name='amount') THEN
    ALTER TABLE "KhipuSubscription" ADD COLUMN "amount" INTEGER NOT NULL DEFAULT 4990;
  END IF;
END $$;

-- Add frequency field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='KhipuSubscription' AND column_name='frequency') THEN
    ALTER TABLE "KhipuSubscription" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'MONTHLY';
  END IF;
END $$;

-- Add nextPaymentDate field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='KhipuSubscription' AND column_name='nextPaymentDate') THEN
    ALTER TABLE "KhipuSubscription" ADD COLUMN "nextPaymentDate" TIMESTAMP(3);
  END IF;
END $$;

-- AlterTable: Add missing Payment fields
-- Add subscriptionId foreign key if not exists (it should exist from 0002)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='Payment' AND column_name='subscriptionId') THEN
    ALTER TABLE "Payment" ADD COLUMN "subscriptionId" UUID;
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" 
      FOREIGN KEY ("subscriptionId") REFERENCES "KhipuSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add transactionId if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='Payment' AND column_name='transactionId') THEN
    ALTER TABLE "Payment" ADD COLUMN "transactionId" TEXT;
  END IF;
END $$;

-- Add providerPaymentId if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='Payment' AND column_name='providerPaymentId') THEN
    ALTER TABLE "Payment" ADD COLUMN "providerPaymentId" TEXT;
  END IF;
END $$;

-- Add currency if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='Payment' AND column_name='currency') THEN
    ALTER TABLE "Payment" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'CLP';
  END IF;
END $$;
