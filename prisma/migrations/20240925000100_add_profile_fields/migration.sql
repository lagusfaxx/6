ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "coverUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionPrice" INTEGER DEFAULT 2500;

CREATE TABLE IF NOT EXISTS "ProfileSubscription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subscriberId" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "price" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfileSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileSubscription_subscriberId_profileId_key" ON "ProfileSubscription"("subscriberId", "profileId");

ALTER TABLE "ProfileSubscription"
  ADD CONSTRAINT "ProfileSubscription_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProfileSubscription"
  ADD CONSTRAINT "ProfileSubscription_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
