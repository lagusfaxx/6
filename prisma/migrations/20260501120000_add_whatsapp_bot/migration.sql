-- WhatsApp bot opt-in fields on User
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "whatsappNumber"        TEXT,
  ADD COLUMN IF NOT EXISTS "whatsappOptIn"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "whatsappVerifiedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whatsappEvents"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "whatsappMessages"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "whatsappReminders"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "whatsappLastInboundAt" TIMESTAMP(3);

-- One-time codes used during WhatsApp opt-in verification
CREATE TABLE IF NOT EXISTS "WhatsAppOtp" (
  "id"        UUID         NOT NULL DEFAULT gen_random_uuid(),
  "userId"    UUID         NOT NULL,
  "phone"     TEXT         NOT NULL,
  "codeHash"  TEXT         NOT NULL,
  "attempts"  INTEGER      NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumed"  BOOLEAN      NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsAppOtp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppOtp_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "WhatsAppOtp_userId_idx" ON "WhatsAppOtp" ("userId");
CREATE INDEX IF NOT EXISTS "WhatsAppOtp_phone_idx"  ON "WhatsAppOtp" ("phone");
