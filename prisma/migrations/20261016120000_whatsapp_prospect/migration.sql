-- Contactos sin cuenta a los que se les envían plantillas de WhatsApp desde el MCP.
CREATE TABLE IF NOT EXISTS "WhatsAppProspect" (
    "waId" TEXT NOT NULL,
    "name" TEXT,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppProspect_pkey" PRIMARY KEY ("waId")
);

CREATE INDEX IF NOT EXISTS "WhatsAppProspect_lastSentAt_idx" ON "WhatsAppProspect"("lastSentAt");
