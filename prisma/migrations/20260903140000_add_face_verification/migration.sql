-- Verificación facial de perfiles pendientes: el admin crea un enlace único y
-- firmado, lo envía por WhatsApp, y la profesional se toma fotos que el admin
-- compara con su galería antes de publicar el perfil.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FaceVerificationStatus') THEN
    CREATE TYPE "FaceVerificationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'APPROVED', 'REJECTED', 'EXPIRED');
  END IF;
END
$$;

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'FACE_VERIFICATION_REVIEWED';

CREATE TABLE IF NOT EXISTS "FaceVerification" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"       UUID NOT NULL,
  "tokenHash"    TEXT NOT NULL,
  "status"       "FaceVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "sentAt"       TIMESTAMP(3),
  "sentTo"       TEXT,
  "submittedAt"  TIMESTAMP(3),
  "reviewedAt"   TIMESTAMP(3),
  "reviewedById" UUID,
  "rejectReason" TEXT,
  "createdById"  UUID,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FaceVerification_tokenHash_key" ON "FaceVerification"("tokenHash");
CREATE INDEX IF NOT EXISTS "FaceVerification_userId_idx" ON "FaceVerification"("userId");
CREATE INDEX IF NOT EXISTS "FaceVerification_status_createdAt_idx" ON "FaceVerification"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "FaceVerificationShot" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "verificationId" UUID NOT NULL,
  "url"            TEXT NOT NULL,
  "pose"           TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FaceVerificationShot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FaceVerificationShot_verificationId_idx" ON "FaceVerificationShot"("verificationId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FaceVerification_userId_fkey') THEN
    ALTER TABLE "FaceVerification" ADD CONSTRAINT "FaceVerification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FaceVerification_createdById_fkey') THEN
    ALTER TABLE "FaceVerification" ADD CONSTRAINT "FaceVerification_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FaceVerification_reviewedById_fkey') THEN
    ALTER TABLE "FaceVerification" ADD CONSTRAINT "FaceVerification_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FaceVerificationShot_verificationId_fkey') THEN
    ALTER TABLE "FaceVerificationShot" ADD CONSTRAINT "FaceVerificationShot_verificationId_fkey"
      FOREIGN KEY ("verificationId") REFERENCES "FaceVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
