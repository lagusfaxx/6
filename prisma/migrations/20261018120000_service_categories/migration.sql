-- Tipos de servicio múltiples por profesional (escort, masajes, contenido…).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "serviceCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Las cuentas que ya existen parten con su categoría principal, para que el
-- panel muestre marcado lo que ya tenían. "Creadora de contenido" la agrega
-- el equipo a mano.
UPDATE "User"
SET "serviceCategories" = ARRAY[lower("primaryCategory")]
WHERE "profileType" = 'PROFESSIONAL'
  AND cardinality("serviceCategories") = 0
  AND lower("primaryCategory") IN ('escort', 'masajes', 'despedidas', 'videollamadas');
