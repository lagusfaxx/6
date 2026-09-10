-- Ficha completa: marca cuándo un perfil profesional llegó a tener todo lo que
-- la ficha pública muestra. Mientras sea NULL el perfil no puede publicarse.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileCompletedAt" TIMESTAMP(3);

-- Los perfiles que ya estaban publicados quedan marcados con su fecha de alta:
-- la regla nueva no puede bajar de un día para otro a quien ya estaba al aire.
-- Sus fichas incompletas las completa el equipo desde el panel.
UPDATE "User"
SET "profileCompletedAt" = "createdAt"
WHERE "profileType" = 'PROFESSIONAL'
  AND "isActive" = true
  AND "profileCompletedAt" IS NULL;
