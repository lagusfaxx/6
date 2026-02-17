-- Add birthdate to users and active flag to service items
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "birthdate" TIMESTAMP(3);
ALTER TABLE "ServiceItem" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
