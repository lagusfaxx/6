-- Publicación automática en X del alta de un perfil profesional.
--
-- El anuncio no se envía en el registro: se encola aquí y el worker lo publica
-- cuando el perfil ya está activo. Así una caída de X nunca rompe un alta y
-- cada intento queda auditable.

DO $$ BEGIN
  CREATE TYPE "SocialNetwork" AS ENUM ('X');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialPostKind" AS ENUM ('NEW_PROFESSIONAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SocialPostStatus" AS ENUM ('PENDING', 'POSTED', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SocialPost" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "network"     "SocialNetwork" NOT NULL DEFAULT 'X',
  "kind"        "SocialPostKind" NOT NULL,
  "userId"      UUID NOT NULL,
  "status"      "SocialPostStatus" NOT NULL DEFAULT 'PENDING',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "text"        TEXT,
  "externalId"  TEXT,
  "lastError"   TEXT,
  "postedAt"    TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);

-- Un anuncio por perfil y tipo: si el alta se reintenta, no se duplica el post.
CREATE UNIQUE INDEX IF NOT EXISTS "SocialPost_network_kind_userId_key"
  ON "SocialPost" ("network", "kind", "userId");

-- El worker busca pendientes ya vencidas en cada pasada.
CREATE INDEX IF NOT EXISTS "SocialPost_status_scheduledAt_idx"
  ON "SocialPost" ("status", "scheduledAt");

DO $$ BEGIN
  ALTER TABLE "SocialPost"
    ADD CONSTRAINT "SocialPost_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
