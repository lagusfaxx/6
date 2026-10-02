-- Gold y Diamond dejan de venderse: el rango es una categorización interna
-- por tarifa (Gold $50.000–$99.999, Diamond $100.000 o más). Lo que se cobra
-- son los boosts; el plan Silver queda como membresía.

-- Historial de tier (el middleware de Prisma no ve este UPDATE).
INSERT INTO "ProfileTierHistory" ("id", "userId", "fromTier", "toTier")
SELECT gen_random_uuid(), u."id", u."tier"::text, t."newTier"
FROM "User" u
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN u."baseRate" IS NULL OR u."baseRate" <= 0 THEN NULL
    WHEN u."baseRate" >= 100000 THEN 'PREMIUM'
    WHEN u."baseRate" >= 50000 THEN 'GOLD'
    ELSE 'SILVER'
  END AS "newTier"
) t
WHERE u."profileType" = 'PROFESSIONAL'
  AND u."tier"::text IS DISTINCT FROM t."newTier";

UPDATE "User"
SET "tier" = (CASE
      WHEN "baseRate" IS NULL OR "baseRate" <= 0 THEN NULL
      WHEN "baseRate" >= 100000 THEN 'PREMIUM'
      WHEN "baseRate" >= 50000 THEN 'GOLD'
      ELSE 'SILVER'
    END)::"ProfessionalTier",
    "tierExpiresAt" = NULL
WHERE "profileType" = 'PROFESSIONAL';

UPDATE "PromoProduct"
SET "isActive" = false, "updatedAt" = CURRENT_TIMESTAMP
WHERE "kind" = 'PLAN' AND "code" IN ('GOLD', 'DIAMOND');

-- La membresía (Silver) es una tarifa fija mensual cobrada por PAC: 30 días.
UPDATE "PromoProduct"
SET "duration" = 30, "name" = 'Membresía', "updatedAt" = CURRENT_TIMESTAMP
WHERE "kind" = 'PLAN' AND "code" = 'SILVER';
