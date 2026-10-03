-- Registro de avisos enviados por SMS o WhatsApp (estadísticas del panel).
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "error" TEXT,
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NotificationDelivery_createdAt_idx"
    ON "NotificationDelivery"("createdAt");

CREATE INDEX IF NOT EXISTS "NotificationDelivery_channel_createdAt_idx"
    ON "NotificationDelivery"("channel", "createdAt");
