-- Respuestas desde WhatsApp: cada aviso enviado guarda a qué chat pertenece,
-- y cada número guarda cuándo escribió por última vez (ventana de 24 h).
CREATE TABLE IF NOT EXISTS "WhatsAppRelay" (
    "wamid" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "peerId" UUID,
    "waId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppRelay_pkey" PRIMARY KEY ("wamid")
);

CREATE INDEX IF NOT EXISTS "WhatsAppRelay_waId_createdAt_idx"
    ON "WhatsAppRelay"("waId", "createdAt");

CREATE TABLE IF NOT EXISTS "WhatsAppContact" (
    "waId" TEXT NOT NULL,
    "lastInboundAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppContact_pkey" PRIMARY KEY ("waId")
);
