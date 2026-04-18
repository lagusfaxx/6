-- AlterTable: forensic acceptance proof fields for U-Mate creators
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "termsAcceptedIp" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "termsAcceptedUserAgent" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "termsAcceptedVersion" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "rulesAcceptedIp" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "rulesAcceptedUserAgent" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "rulesAcceptedVersion" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "contractAcceptedIp" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "contractAcceptedUserAgent" TEXT;
ALTER TABLE "UmateCreator" ADD COLUMN IF NOT EXISTS "contractAcceptedVersion" TEXT;

-- AlterTable: per-publication content-authorship attestation
ALTER TABLE "UmatePost" ADD COLUMN IF NOT EXISTS "authorshipAttestedAt" TIMESTAMP(3);
ALTER TABLE "UmatePost" ADD COLUMN IF NOT EXISTS "authorshipAttestedIp" TEXT;
ALTER TABLE "UmatePost" ADD COLUMN IF NOT EXISTS "authorshipAttestedUserAgent" TEXT;
ALTER TABLE "UmatePost" ADD COLUMN IF NOT EXISTS "authorshipAttestedVersion" TEXT;
