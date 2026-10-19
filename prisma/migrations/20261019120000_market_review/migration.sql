-- Revisión de los packs antes de salir a la venta. Los que ya están
-- publicados quedan aprobados; los nuevos nacen pendientes desde la API.
ALTER TABLE "MarketProduct" ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "MarketProduct" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "MarketProduct_reviewStatus_idx" ON "MarketProduct"("reviewStatus");

-- Primeras ventas sin comisión (sólo IVA).
ALTER TABLE "MarketSettings" ADD COLUMN IF NOT EXISTS "freeSalesCount" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "MarketSettings" ADD COLUMN IF NOT EXISTS "ivaPercent" DOUBLE PRECISION NOT NULL DEFAULT 19;
