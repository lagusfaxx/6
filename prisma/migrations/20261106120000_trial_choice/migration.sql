-- Elección de prueba al registrarse: con tarjeta (más días) o sin tarjeta.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "needsTrialChoice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialStartedAt" TIMESTAMP(3);
