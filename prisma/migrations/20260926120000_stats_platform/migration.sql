-- Estadísticas: captura ampliada (UTM, dispositivo, PWA, origen de registro,
-- última edición), búsquedas, impresiones por perfil/día, historial de tier,
-- anotaciones, segmentos y alertas.

ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;
ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "device" TEXT;
ALTER TABLE "PageView" ADD COLUMN IF NOT EXISTS "displayMode" TEXT;
CREATE INDEX IF NOT EXISTS "PageView_visitorId_createdAt_idx" ON "PageView"("visitorId", "createdAt");
CREATE INDEX IF NOT EXISTS "PageView_sessionId_createdAt_idx" ON "PageView"("sessionId", "createdAt");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "signupSource" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SearchLog" (
    "id" UUID NOT NULL,
    "q" TEXT,
    "categorySlug" TEXT,
    "city" TEXT,
    "entityType" TEXT,
    "filters" JSONB,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "userId" UUID,
    "sessionId" TEXT,
    "visitorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SearchLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchLog_createdAt_idx" ON "SearchLog"("createdAt");
CREATE INDEX IF NOT EXISTS "SearchLog_city_createdAt_idx" ON "SearchLog"("city", "createdAt");
CREATE INDEX IF NOT EXISTS "SearchLog_categorySlug_createdAt_idx" ON "SearchLog"("categorySlug", "createdAt");

CREATE TABLE IF NOT EXISTS "ProfileDailyStats" (
    "profileId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "positionSum" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProfileDailyStats_pkey" PRIMARY KEY ("profileId", "date")
);
CREATE INDEX IF NOT EXISTS "ProfileDailyStats_date_idx" ON "ProfileDailyStats"("date");

CREATE TABLE IF NOT EXISTS "ProfileTierHistory" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fromTier" TEXT,
    "toTier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileTierHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ProfileTierHistory_userId_createdAt_idx" ON "ProfileTierHistory"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "ProfileTierHistory_createdAt_idx" ON "ProfileTierHistory"("createdAt");

CREATE TABLE IF NOT EXISTS "StatsAnnotation" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StatsAnnotation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StatsAnnotation_date_idx" ON "StatsAnnotation"("date");

CREATE TABLE IF NOT EXISTS "StatsSegment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatsSegment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StatsSegment_name_key" ON "StatsSegment"("name");

CREATE TABLE IF NOT EXISTS "StatsAlert" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "metric" TEXT,
    "comparison" TEXT,
    "direction" TEXT,
    "threshold" DOUBLE PRECISION,
    "period" TEXT NOT NULL DEFAULT '7d',
    "filters" JSONB,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastFiredAt" TIMESTAMP(3),
    "lastValue" DOUBLE PRECISION,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StatsAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StatsAlert_enabled_idx" ON "StatsAlert"("enabled");

-- La última edición parte igual a la fecha de publicación (o de registro)
-- para no marcar a todo el mundo como "sin actualizar" el primer día.
UPDATE "User" SET "lastEditedAt" = COALESCE("profileCompletedAt", "createdAt") WHERE "lastEditedAt" IS NULL;
