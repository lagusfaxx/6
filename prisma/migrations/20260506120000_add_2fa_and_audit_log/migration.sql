-- Two-factor authentication (TOTP / Google Authenticator) fields on User.
-- totpSecret stores AES-256-GCM ciphertext (iv:tag:cipher base64), never
-- a raw shared secret. Backup codes are stored as argon2 hashes joined by
-- newlines so we can rewrite the column without the consumed code.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totpSecret" TEXT,
  ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "totpBackupCodesHash" TEXT,
  ADD COLUMN IF NOT EXISTS "lastTotpVerifiedAt" TIMESTAMP(3);

-- Append-only admin audit log used for forensic review of destructive or
-- privilege-escalating admin actions (delete user, role change, withdrawal
-- approvals, etc.). Written from endpoints behind requireAdmin + step-up.
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adminId"    UUID NOT NULL,
  "adminEmail" TEXT NOT NULL,
  "action"     TEXT NOT NULL,
  "targetType" TEXT,
  "targetId"   TEXT,
  "metadata"   JSONB,
  "ip"         TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AdminAuditLog_adminId_createdAt_idx"
  ON "AdminAuditLog" ("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_action_createdAt_idx"
  ON "AdminAuditLog" ("action", "createdAt");
