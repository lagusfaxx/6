ALTER TABLE "User"
  ADD COLUMN "heightCm" INTEGER,
  ADD COLUMN "weightKg" INTEGER,
  ADD COLUMN "measurements" TEXT,
  ADD COLUMN "hairColor" TEXT,
  ADD COLUMN "skinTone" TEXT,
  ADD COLUMN "languages" TEXT,
  ADD COLUMN "serviceStyleTags" TEXT,
  ADD COLUMN "availabilityNote" TEXT,
  ADD COLUMN "baseRate" INTEGER,
  ADD COLUMN "minDurationMinutes" INTEGER,
  ADD COLUMN "acceptsIncalls" BOOLEAN,
  ADD COLUMN "acceptsOutcalls" BOOLEAN;
