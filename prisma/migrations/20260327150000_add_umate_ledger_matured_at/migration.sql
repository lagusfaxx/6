-- Add maturedAt column to UmateLedgerEntry for tracking balance maturation
ALTER TABLE "UmateLedgerEntry" ADD COLUMN "maturedAt" TIMESTAMP(3);
