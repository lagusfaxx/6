-- Respuestas que las profesionales mandan desde WhatsApp (panel /admin/whatsapp).
CREATE TABLE IF NOT EXISTS "WhatsAppReply" (
    "id" UUID NOT NULL,
    "waId" TEXT NOT NULL,
    "userId" UUID,
    "peerId" UUID,
    "messageId" UUID,
    "kind" TEXT NOT NULL,
    "body" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhatsAppReply_createdAt_idx" ON "WhatsAppReply"("createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppReply_userId_createdAt_idx" ON "WhatsAppReply"("userId", "createdAt");
