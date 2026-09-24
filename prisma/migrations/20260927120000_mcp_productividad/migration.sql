-- ─────────────────────────────────────────────────────────────────────────
-- MCP: más productividad sin abrir datos sensibles.
--  1. Vistas agregadas `mcp_*` para consulta_sql: responden preguntas sobre
--     columnas que el rol lector no puede leer (email, teléfono, ubicación
--     exacta, texto de mensajes) sin entregar el dato.
--  2. Notas internas del equipo sobre un usuario.
--  3. Tipo de notificación para los avisos que manda el equipo.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_MESSAGE';

CREATE TABLE IF NOT EXISTS "AdminUserNote" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "authorId" UUID,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'panel',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminUserNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminUserNote_userId_createdAt_idx" ON "AdminUserNote"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "AdminUserNote" ADD CONSTRAINT "AdminUserNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Qué datos de contacto tiene cada cuenta, sin el dato. El dominio del
-- correo sólo se muestra si es un proveedor masivo; uno propio identifica.
CREATE OR REPLACE VIEW mcp_cuenta_datos AS
SELECT
  u."id" AS "userId",
  (COALESCE(u."email", '') <> '') AS "tieneEmail",
  CASE
    WHEN COALESCE(u."email", '') = '' THEN NULL
    WHEN lower(split_part(u."email", '@', 2)) IN (
      'gmail.com', 'hotmail.com', 'hotmail.cl', 'hotmail.es', 'outlook.com', 'outlook.es', 'outlook.cl',
      'live.com', 'live.cl', 'yahoo.com', 'yahoo.es', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com'
    ) THEN lower(split_part(u."email", '@', 2))
    ELSE 'otro'
  END AS "dominioEmail",
  (COALESCE(u."phone", '') <> '') AS "tieneTelefono",
  (u."latitude" IS NOT NULL AND u."longitude" IS NOT NULL) AS "tieneUbicacionExacta",
  (COALESCE(u."address", '') <> '') AS "tieneDireccion",
  (u."verifiedByPhone" IS NOT NULL) AS "verificadoPorTelefono",
  (u."flowCardType" IS NOT NULL) AS "tieneTarjetaGuardada",
  u."twoFactorEnabled" AS "tiene2fa"
FROM "User" u;

-- Mapa de oferta: perfiles por celda de ~1 km (2 decimales). Sólo celdas con
-- 3 o más perfiles, para que ninguna fila apunte a una persona.
CREATE OR REPLACE VIEW mcp_zona_perfiles AS
SELECT
  round(u."latitude"::numeric, 2)::float8 AS "latAprox",
  round(u."longitude"::numeric, 2)::float8 AS "lngAprox",
  u."profileType"::text AS "tipoPerfil",
  count(*)::int AS "perfiles",
  count(*) FILTER (WHERE u."isActive" AND u."isVerified")::int AS "publicados"
FROM "User" u
WHERE u."latitude" IS NOT NULL AND u."longitude" IS NOT NULL
  AND u."role" = 'USER' AND u."email" NOT LIKE '%@testseed.uzeed.cl'
GROUP BY 1, 2, 3
HAVING count(*) >= 3;

-- Volumen de mensajería por día (hora de Chile) y par de usuarios, sin texto.
CREATE OR REPLACE VIEW mcp_mensajes_diarios AS
SELECT
  ((m."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago')::date AS "dia",
  m."fromId",
  m."toId",
  count(*)::int AS "mensajes",
  count(*) FILTER (WHERE m."readAt" IS NOT NULL)::int AS "leidos",
  round(avg(length(m."body")))::int AS "largoPromedio"
FROM "Message" m
GROUP BY 1, 2, 3;

/*
 * Igual que antes, más: las vistas `mcp_*` se conceden completas (ya vienen
 * agregadas y sin datos sensibles). Se leen con los permisos de su dueño, así
 * que el rol lector no necesita acceso a las columnas de origen.
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
    'McpAuditLog', 'McpOAuthClient', 'McpOAuthCode', 'McpOAuthToken',
    'AdminUserNote'
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
  FOR t IN
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public' AND table_name LIKE 'mcp\_%'
  LOOP
    EXECUTE format('GRANT SELECT ON %I TO uzeed_mcp_reader', t.table_name);
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
