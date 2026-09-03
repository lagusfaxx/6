-- El número de WhatsApp es la identidad de contacto de una profesional: si lo
-- cambia sola, la cuenta anterior queda abandonada y ensucia la app. El cambio
-- pasa a revisarse desde el admin mediante estas solicitudes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PhoneChangeRequestStatus') THEN
    CREATE TYPE "PhoneChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END
$$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PHONE_CHANGE_REVIEWED';

CREATE TABLE IF NOT EXISTS "PhoneChangeRequest" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"         UUID NOT NULL,
  "currentPhone"   TEXT,
  "requestedPhone" TEXT NOT NULL,
  "reason"         TEXT,
  "status"         "PhoneChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById"   UUID,
  "reviewedAt"     TIMESTAMP(3),
  "adminNote"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PhoneChangeRequest_userId_idx" ON "PhoneChangeRequest"("userId");
CREATE INDEX IF NOT EXISTS "PhoneChangeRequest_status_createdAt_idx" ON "PhoneChangeRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PhoneChangeRequest_userId_fkey'
  ) THEN
    ALTER TABLE "PhoneChangeRequest"
      ADD CONSTRAINT "PhoneChangeRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PhoneChangeRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "PhoneChangeRequest"
      ADD CONSTRAINT "PhoneChangeRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
