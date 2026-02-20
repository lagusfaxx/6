-- Active Location: add regionName, locationUpdatedAt, popularityScore, and PLATINUM tier

-- Add new fields to User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "regionName" TEXT,
  ADD COLUMN IF NOT EXISTS "locationUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add PLATINUM to ProfessionalTier enum
ALTER TYPE "ProfessionalTier" ADD VALUE IF NOT EXISTS 'PLATINUM';

-- Create index for city-based queries
CREATE INDEX IF NOT EXISTS "User_city_idx" ON "User"("city");

-- Create index for geospatial-like queries (lat/lng sorting)
CREATE INDEX IF NOT EXISTS "User_lat_lng_idx" ON "User"("latitude", "longitude");

-- Create composite index for ranking (tier + last activity)
CREATE INDEX IF NOT EXISTS "User_tier_lastSeen_idx" ON "User"("tier", "lastSeen");
