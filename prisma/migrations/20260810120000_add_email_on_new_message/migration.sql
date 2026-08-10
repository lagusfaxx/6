-- Preferencia de aviso por correo de mensajes sin leer.
-- Por defecto activada: es el canal de aviso mientras no exista la API de
-- WhatsApp. Se desactiva desde /cuenta o con el enlace de baja del correo.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "emailOnNewMessage" BOOLEAN NOT NULL DEFAULT true;

-- El worker consulta mensajes sin leer por destinatario y fecha; sin este
-- índice el barrido hace scan completo de Message a medida que crece.
CREATE INDEX IF NOT EXISTS "Message_toId_readAt_createdAt_idx"
  ON "Message" ("toId", "readAt", "createdAt");
