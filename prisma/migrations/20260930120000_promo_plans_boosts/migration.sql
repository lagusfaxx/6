-- Planes (Silver/Gold/Diamond) y boosts de perfiles, pagables con Flow o tokens.

ALTER TYPE "PaymentIntentPurpose" ADD VALUE IF NOT EXISTS 'PROMO_PURCHASE';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'TOKENS';
ALTER TYPE "TokenTxType" ADD VALUE IF NOT EXISTS 'PROMO_PURCHASE';

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tierExpiresAt" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "PromoKind" AS ENUM ('PLAN', 'BOOST');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PromoCode" AS ENUM ('SILVER', 'GOLD', 'DIAMOND', 'BUMP', 'SPOTLIGHT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "PromoProduct" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kind" "PromoKind" NOT NULL,
    "code" "PromoCode" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "duration" INTEGER NOT NULL,
    "priceClp" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoProduct_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromoProduct_kind_isActive_sortOrder_idx" ON "PromoProduct"("kind", "isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "ProfileBoost" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "productId" UUID,
    "code" "PromoCode" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "paidWith" TEXT NOT NULL,
    "amountClp" INTEGER NOT NULL DEFAULT 0,
    "paymentIntentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileBoost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileBoost_paymentIntentId_key" ON "ProfileBoost"("paymentIntentId");
CREATE INDEX IF NOT EXISTS "ProfileBoost_code_endsAt_idx" ON "ProfileBoost"("code", "endsAt");
CREATE INDEX IF NOT EXISTS "ProfileBoost_userId_endsAt_idx" ON "ProfileBoost"("userId", "endsAt");

DO $$ BEGIN
  ALTER TABLE "ProfileBoost" ADD CONSTRAINT "ProfileBoost_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ProfileBoost" ADD CONSTRAINT "ProfileBoost_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "PromoProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Catálogo inicial (el admin lo ajusta en /admin/cobros). El Silver toma la
-- tarifa de membresía que ya estuviera configurada.
INSERT INTO "PromoProduct" ("kind", "code", "name", "description", "duration", "priceClp", "sortOrder")
SELECT v.kind::"PromoKind", v.code::"PromoCode", v.name, v.description, v.duration, v.price, v.sort
FROM (VALUES
  ('PLAN',  'SILVER',    'Silver',        'Tu perfil visible en el directorio, la búsqueda y el mapa.', 30,
     COALESCE((SELECT value::int FROM "PlatformConfig" WHERE key = 'billing_price_clp'), 4990), 10),
  ('PLAN',  'GOLD',      'Gold',          'Sección Gold del inicio, antes que Silver en búsquedas e insignia Gold.', 30, 14990, 20),
  ('PLAN',  'DIAMOND',   'Diamond',       'Lo más alto: sección Diamond sobre el mapa, primero en búsquedas e insignia Diamond.', 30, 29990, 30),
  ('BOOST', 'BUMP',      'Subir al top',  'Primer lugar en la búsqueda y los listados de tu comuna.', 24, 2990, 10),
  ('BOOST', 'SPOTLIGHT', 'Destacada 3 días', 'Arriba del inicio en "Destacadas", primer lugar en búsquedas e insignia.', 72, 6990, 20),
  ('BOOST', 'SPOTLIGHT', 'Destacada 7 días', 'Arriba del inicio en "Destacadas", primer lugar en búsquedas e insignia.', 168, 12990, 30)
) AS v(kind, code, name, description, duration, price, sort)
WHERE NOT EXISTS (SELECT 1 FROM "PromoProduct");

-- Los planes asignados a mano siguen sin vencimiento (tierExpiresAt NULL).
