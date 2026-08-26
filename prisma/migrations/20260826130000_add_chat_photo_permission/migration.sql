-- Permiso de fotos en el chat.
-- La profesional decide si los clientes pueden enviarle imágenes. Empieza
-- apagado: un cliente no puede mandar una foto a quien no la habilitó.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "allowChatPhotos" BOOLEAN NOT NULL DEFAULT false;
