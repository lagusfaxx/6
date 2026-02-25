ALTER TABLE "ServiceItem"
  ADD COLUMN "locality" TEXT,
  ADD COLUMN "approxAreaM" INTEGER,
  ADD COLUMN "locationVerified" BOOLEAN NOT NULL DEFAULT false;
