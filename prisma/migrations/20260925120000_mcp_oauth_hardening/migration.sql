-- ─────────────────────────────────────────────────────────────────────────
-- MCP: OAuth 2.1 (clientes, códigos y tokens; sólo se guardan hashes) y
-- bitácora con usuario, cliente e IP.
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE "McpAuditLog" ADD COLUMN IF NOT EXISTS "userId" UUID;
ALTER TABLE "McpAuditLog" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "McpAuditLog" ADD COLUMN IF NOT EXISTS "ip" TEXT;
CREATE INDEX IF NOT EXISTS "McpAuditLog_userId_createdAt_idx" ON "McpAuditLog"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "McpOAuthClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "secretHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    CONSTRAINT "McpOAuthClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "McpOAuthCode" (
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpOAuthCode_pkey" PRIMARY KEY ("codeHash")
);
CREATE INDEX IF NOT EXISTS "McpOAuthCode_expiresAt_idx" ON "McpOAuthCode"("expiresAt");

CREATE TABLE IF NOT EXISTS "McpOAuthToken" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "accessHash" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
    "familyExpiresAt" TIMESTAMP(3) NOT NULL,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "lastIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpOAuthToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthToken_accessHash_key" ON "McpOAuthToken"("accessHash");
CREATE UNIQUE INDEX IF NOT EXISTS "McpOAuthToken_refreshHash_key" ON "McpOAuthToken"("refreshHash");
CREATE INDEX IF NOT EXISTS "McpOAuthToken_familyId_idx" ON "McpOAuthToken"("familyId");
CREATE INDEX IF NOT EXISTS "McpOAuthToken_userId_revokedAt_idx" ON "McpOAuthToken"("userId", "revokedAt");

DO $$ BEGIN
  ALTER TABLE "McpOAuthCode" ADD CONSTRAINT "McpOAuthCode_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "McpOAuthToken" ADD CONSTRAINT "McpOAuthToken_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "McpOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Rol de sólo lectura para la herramienta consulta_sql. Es la base de datos
-- la que niega lo sensible, no una lista en el código. Si el usuario de la
-- base no puede crear roles, la migración sigue y consulta_sql queda
-- desactivada (falla cerrada).
-- ─────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uzeed_mcp_reader') THEN
    CREATE ROLE uzeed_mcp_reader NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
  END IF;
  EXECUTE format('GRANT uzeed_mcp_reader TO %I', current_user);
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'Sin permiso para crear el rol uzeed_mcp_reader: consulta_sql queda desactivada.';
END $$;

/*
 * Rehace los permisos del rol a nivel de columna: todo lo que no esté en la
 * lista negra de tablas ni calce con el patrón de columnas sensibles. Como es
 * por columna, una tabla o columna nueva queda invisible hasta que se vuelva
 * a ejecutar (la API lo hace al arrancar), y si es sensible por nombre no se
 * concede nunca.
 */
CREATE OR REPLACE FUNCTION mcp_reader_refresh_grants() RETURNS text
LANGUAGE plpgsql AS $fn$
DECLARE
  t record;
  cols text;
  excluded_tables text[] := ARRAY[
    'session', '_prisma_migrations',
    'PushSubscription', 'FaceVerificationShot', 'PendingGoldRegistration',
    'MarketProductAsset', 'MarketOrderAsset', 'UmatePostMedia',
    'McpAuditLog', 'McpOAuthClient', 'McpOAuthCode', 'McpOAuthToken'
  ];
  -- Credenciales, secretos, contacto personal, datos bancarios, ubicación
  -- exacta, IPs y huellas legales, mensajes privados, documentos y archivos.
  sensitive text :=
    '(assword|ecret|[Tt]okenHash|SetToken|^p256dh$|^auth$|^endpoint$|'
    || '[Rr]ut$|[Aa]ccountNumber|^bankSnapshot$|^bankEmail$|Ip$|^ip$|[a-z]UserAgent$|'
    || '^flowCustomerId$|^flowSubscriptionId$|^flowCard|^card|^pacMandateId$|'
    || '^body$|^formData$|^fileUrls?$|[Rr]eceiptUrl$|^imageUrl$|^verifiedByPhone$|^twoFactor|'
    || '^latitude$|^longitude$|^address$|^ship(Address|Phone|Name|Notes)$|'
    || '[Pp]hone$|^email$|[a-z]Email$)';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'uzeed_mcp_reader') THEN
    RETURN 'sin-rol';
  END IF;
  EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM uzeed_mcp_reader';
  EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM uzeed_mcp_reader';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO uzeed_mcp_reader';
  FOR t IN
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND NOT (table_name = ANY (excluded_tables))
  LOOP
    SELECT string_agg(quote_ident(column_name), ', ') INTO cols
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t.table_name
      AND column_name !~ sensitive;
    IF cols IS NOT NULL THEN
      EXECUTE format('GRANT SELECT (%s) ON %I TO uzeed_mcp_reader', cols, t.table_name);
    END IF;
  END LOOP;
  RETURN 'ok';
END
$fn$;

REVOKE ALL ON FUNCTION mcp_reader_refresh_grants() FROM PUBLIC;

DO $$ BEGIN
  PERFORM mcp_reader_refresh_grants();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'No se pudieron conceder permisos a uzeed_mcp_reader.';
END $$;
