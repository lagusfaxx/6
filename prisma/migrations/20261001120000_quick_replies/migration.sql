-- Respuestas rápidas de las profesionales (tarifa, servicios, horario...) que
-- el cliente toca en el chat para recibir la respuesta al instante.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "quickReplies" JSONB;

CREATE TABLE IF NOT EXISTS "QuickReplyAnswer" (
    "messageId" UUID NOT NULL,
    "professionalId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuickReplyAnswer_pkey" PRIMARY KEY ("messageId")
);

CREATE INDEX IF NOT EXISTS "QuickReplyAnswer_professionalId_createdAt_idx"
    ON "QuickReplyAnswer"("professionalId", "createdAt");
