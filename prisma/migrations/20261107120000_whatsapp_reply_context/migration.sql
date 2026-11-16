-- A qué aviso responde la profesional cuando contesta desde WhatsApp algo que
-- no es un chat (difusión, aviso de plan…): /admin/whatsapp lo muestra.
ALTER TABLE "WhatsAppRelay" ADD COLUMN IF NOT EXISTS "kind" TEXT;
ALTER TABLE "WhatsAppReply" ADD COLUMN IF NOT EXISTS "inReplyTo" TEXT;
-- Para no repetirle al mismo número la respuesta automática del bot.
CREATE INDEX IF NOT EXISTS "WhatsAppReply_waId_createdAt_idx" ON "WhatsAppReply"("waId", "createdAt");
