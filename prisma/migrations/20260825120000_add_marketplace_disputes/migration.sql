-- Reclamos del marketplace: si el pedido no llega, la compradora abre un
-- reclamo y el pago deja de liberarse solo hasta que administración decide.
-- El barrido automático ya filtra por estado, así que pasar a DISPUTED congela
-- la retención sin tocar el worker.
ALTER TABLE "MarketOrder"
  ADD COLUMN IF NOT EXISTS "disputedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "disputeReason" TEXT,
  ADD COLUMN IF NOT EXISTS "disputeResolution" TEXT,
  ADD COLUMN IF NOT EXISTS "releaseWarnedAt" TIMESTAMP(3);

-- El worker busca los pedidos por vencer para avisar antes de liberar.
CREATE INDEX IF NOT EXISTS "MarketOrder_payoutStatus_autoReleaseAt_idx"
  ON "MarketOrder" ("payoutStatus", "autoReleaseAt");
