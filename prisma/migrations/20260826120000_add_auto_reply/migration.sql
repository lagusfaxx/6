-- Respuesta automática de las profesionales.
-- Se envía sola 20 segundos después del primer mensaje de un cliente, aparece
-- en el chat como un mensaje normal y no marca como leído el mensaje del
-- cliente: el aviso para la profesional se mantiene.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoReplyMessage" TEXT;

-- Una respuesta automática por conversación cada 24 horas. Se guarda aquí y no
-- en Message para que el mensaje enviado sea indistinguible de uno escrito a
-- mano por la profesional.
CREATE TABLE IF NOT EXISTS "AutoReplyLog" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "professionalId" UUID NOT NULL,
  "clientId"       UUID NOT NULL,
  "sentAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutoReplyLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AutoReplyLog_professionalId_clientId_key"
  ON "AutoReplyLog" ("professionalId", "clientId");

CREATE INDEX IF NOT EXISTS "AutoReplyLog_sentAt_idx" ON "AutoReplyLog" ("sentAt");
