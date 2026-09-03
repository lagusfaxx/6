-- Ocultar historias desde el admin sin borrarlas y poder renovar historias
-- antiguas para que vuelvan a aparecer junto a las nuevas.
ALTER TABLE "Story"
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "renewedAt" TIMESTAMP(3);

-- Las consultas del feed filtran por historias visibles y no expiradas.
CREATE INDEX IF NOT EXISTS "Story_isHidden_expiresAt_idx" ON "Story"("isHidden", "expiresAt");
