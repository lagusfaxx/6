-- Automated identity verification (KYC) via external provider (Didit).
CREATE TYPE "IdentityVerificationStatus" AS ENUM (
  'PENDING', 'IN_PROGRESS', 'IN_REVIEW', 'APPROVED', 'DECLINED', 'EXPIRED'
);

CREATE TABLE "IdentityVerification" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"       UUID NOT NULL,
  "provider"     TEXT NOT NULL DEFAULT 'didit',
  "sessionId"    TEXT NOT NULL,
  "status"       "IdentityVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "decision"     TEXT,
  "isAdult"      BOOLEAN,
  "documentType" TEXT,
  "rejectReason" TEXT,
  "payload"      JSONB,
  "reviewedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdentityVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityVerification_sessionId_key" ON "IdentityVerification"("sessionId");
CREATE INDEX "IdentityVerification_userId_idx" ON "IdentityVerification"("userId");
CREATE INDEX "IdentityVerification_status_idx" ON "IdentityVerification"("status");

ALTER TABLE "IdentityVerification"
  ADD CONSTRAINT "IdentityVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
