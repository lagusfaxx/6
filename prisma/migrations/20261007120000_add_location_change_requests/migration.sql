-- La comuna es lo que sale en la ficha y en los listados por zona: si la
-- profesional la cambia sola (a otra ciudad o a otro país) ensucia los
-- resultados. El cambio pasa a revisarse desde el admin mediante estas
-- solicitudes, igual que el teléfono y el nombre.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LocationChangeRequestStatus') THEN
    CREATE TYPE "LocationChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END
$$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOCATION_CHANGE_REVIEWED';

CREATE TABLE IF NOT EXISTS "LocationChangeRequest" (
  "id"                 UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"             UUID NOT NULL,
  "currentAddress"     TEXT,
  "currentCity"        TEXT,
  "currentLatitude"    DOUBLE PRECISION,
  "currentLongitude"   DOUBLE PRECISION,
  "requestedAddress"   TEXT NOT NULL,
  "requestedCity"      TEXT,
  "requestedLatitude"  DOUBLE PRECISION NOT NULL,
  "requestedLongitude" DOUBLE PRECISION NOT NULL,
  "reason"             TEXT,
  "status"             "LocationChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById"       UUID,
  "reviewedAt"         TIMESTAMP(3),
  "adminNote"          TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocationChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LocationChangeRequest_userId_idx" ON "LocationChangeRequest"("userId");
CREATE INDEX IF NOT EXISTS "LocationChangeRequest_status_createdAt_idx" ON "LocationChangeRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LocationChangeRequest_userId_fkey'
  ) THEN
    ALTER TABLE "LocationChangeRequest"
      ADD CONSTRAINT "LocationChangeRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LocationChangeRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "LocationChangeRequest"
      ADD CONSTRAINT "LocationChangeRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
