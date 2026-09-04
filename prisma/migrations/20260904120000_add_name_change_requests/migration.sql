-- El nombre público es con lo que se reconoce el anuncio: si la profesional lo
-- cambia sola, quien la tenía guardada o vio una captura ya no la encuentra.
-- El cambio pasa a revisarse desde el admin mediante estas solicitudes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'NameChangeRequestStatus') THEN
    CREATE TYPE "NameChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END
$$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NAME_CHANGE_REVIEWED';

CREATE TABLE IF NOT EXISTS "NameChangeRequest" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"        UUID NOT NULL,
  "currentName"   TEXT,
  "requestedName" TEXT NOT NULL,
  "reason"        TEXT,
  "status"        "NameChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById"  UUID,
  "reviewedAt"    TIMESTAMP(3),
  "adminNote"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NameChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NameChangeRequest_userId_idx" ON "NameChangeRequest"("userId");
CREATE INDEX IF NOT EXISTS "NameChangeRequest_status_createdAt_idx" ON "NameChangeRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NameChangeRequest_userId_fkey'
  ) THEN
    ALTER TABLE "NameChangeRequest"
      ADD CONSTRAINT "NameChangeRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NameChangeRequest_reviewedById_fkey'
  ) THEN
    ALTER TABLE "NameChangeRequest"
      ADD CONSTRAINT "NameChangeRequest_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
