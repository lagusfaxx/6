CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "PaymentIntentPurpose" AS ENUM ('CREATOR_SUBSCRIPTION', 'SHOP_PLAN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentIntentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ProfileMedia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "ownerId" uuid NOT NULL,
  "type" "MediaType" NOT NULL,
  "url" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ServiceMedia" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceItemId" uuid NOT NULL,
  "type" "MediaType" NOT NULL,
  "url" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "PaymentIntent" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "subscriberId" uuid NOT NULL,
  "profileId" uuid,
  "purpose" "PaymentIntentPurpose" NOT NULL,
  "status" "PaymentIntentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" integer NOT NULL,
  "providerPaymentId" text,
  "paymentUrl" text,
  "paidAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ProfileMedia_ownerId_idx" ON "ProfileMedia"("ownerId");
CREATE INDEX IF NOT EXISTS "ServiceMedia_serviceItemId_idx" ON "ServiceMedia"("serviceItemId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_subscriberId_idx" ON "PaymentIntent"("subscriberId");
CREATE INDEX IF NOT EXISTS "PaymentIntent_profileId_idx" ON "PaymentIntent"("profileId");

DO $$ BEGIN
  ALTER TABLE "ProfileMedia"
    ADD CONSTRAINT "ProfileMedia_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ServiceMedia"
    ADD CONSTRAINT "ServiceMedia_serviceItemId_fkey"
    FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_subscriberId_fkey"
    FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentIntent"
    ADD CONSTRAINT "PaymentIntent_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
