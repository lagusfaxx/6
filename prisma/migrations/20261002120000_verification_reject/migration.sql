-- Rechazo de verificación con motivo: saca el perfil de la cola de pendientes
-- hasta que la profesional corrija su ficha.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationRejectedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "verificationRejectReason" TEXT;
