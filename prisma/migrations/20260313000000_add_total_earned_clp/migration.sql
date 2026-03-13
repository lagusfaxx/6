-- AlterTable
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "totalEarnedClp" INTEGER NOT NULL DEFAULT 0;

-- Backfill totalEarnedClp from completed service requests
UPDATE "User" u
SET "totalEarnedClp" = COALESCE(sub.total, 0)
FROM (
  SELECT "professionalId", SUM(COALESCE("professionalPriceClp", 0)) AS total
  FROM "ServiceRequest"
  WHERE "status" = 'FINALIZADO'
  GROUP BY "professionalId"
) sub
WHERE u.id = sub."professionalId";
