-- Visitante persistente para estadísticas más precisas (visitantes únicos y
-- clicks deduplicados). Columnas opcionales: las filas antiguas quedan en NULL.
ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
ALTER TABLE "UserAction" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "UserAction" ADD COLUMN IF NOT EXISTS "visitorId" TEXT;
