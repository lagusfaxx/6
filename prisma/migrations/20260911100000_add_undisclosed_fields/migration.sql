-- "Prefiero no decirlo": datos de la ficha que la profesional elige no
-- publicar. Cuentan como resueltos para poder publicar el perfil, y en la
-- ficha pública simplemente no aparecen.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "undisclosedFields" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
