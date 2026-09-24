import { createHash, createHmac, pbkdf2Sync, randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../db";
import { mcpEnabled } from "./oauth/config";
import { SQL_READER_USER, buildReaderUrl, enableSqlReader } from "./sqlReader";

const READER_ROLE = "uzeed_mcp_reader";
const MIN_PASSWORD_LENGTH = 16;

/**
 * Hash SCRAM-SHA-256 en el formato que Postgres guarda en pg_authid. Se le
 * manda el hash y no la clave: así la clave no aparece en los logs de
 * Postgres aunque registren cada sentencia.
 */
function scramSha256(password: string): string {
  const salt = randomBytes(16);
  const iterations = 4096;
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

/**
 * Prepara todo lo de la base para el MCP al arrancar, sin pasos manuales:
 *  1. El rol `uzeed_mcp_reader` (normalmente ya lo creó la migración).
 *  2. Sus permisos por columna, recalculados: una tabla o columna nueva queda
 *     visible para consulta_sql sólo si no es sensible por nombre.
 *  3. El usuario `uzeed_mcp_sql` con la clave de MCP_SQL_PASSWORD, miembro
 *     sólo de ese rol, en sólo lectura y con tope de 20 s por consulta.
 *  4. Una prueba de conexión con ese usuario.
 * Si algo falla, consulta_sql no se habilita y el resto del MCP sigue.
 */
export async function prepareMcpDatabase() {
  if (!mcpEnabled()) return;

  try {
    await prisma.$executeRawUnsafe(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${READER_ROLE}') THEN
        CREATE ROLE ${READER_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
      END IF;
    END $$`);
    const rows = await prisma.$queryRaw<{ r: string }[]>`SELECT mcp_reader_refresh_grants() AS r`;
    if (rows[0]?.r !== "ok") {
      console.warn(`[mcp] rol lector: ${rows[0]?.r}. consulta_sql queda desactivada.`);
      return;
    }
  } catch (err: any) {
    console.warn("[mcp] no se pudo preparar el rol lector; consulta_sql queda desactivada:", err?.message || err);
    return;
  }

  const password = process.env.MCP_SQL_PASSWORD || "";
  if (!password) {
    console.warn("[mcp] sin MCP_SQL_PASSWORD: consulta_sql queda desactivada.");
    return;
  }
  // Sólo caracteres seguros en una URL (y nada que se pueda colar en SQL).
  if (password.length < MIN_PASSWORD_LENGTH || !/^[A-Za-z0-9._~-]+$/.test(password)) {
    console.warn(
      `[mcp] MCP_SQL_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres y sólo letras, números, punto, guion o guion bajo. consulta_sql queda desactivada.`,
    );
    return;
  }

  try {
    const hash = scramSha256(password);
    const exists = await prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM pg_roles WHERE rolname = ${SQL_READER_USER}`;
    // El hash sólo lleva base64, dígitos y $ : — no puede romper la sentencia.
    if (!/^SCRAM-SHA-256\$\d+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(hash)) throw new Error("hash inválido");
    if (exists[0]?.n) {
      await prisma.$executeRawUnsafe(`ALTER ROLE ${SQL_READER_USER} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT PASSWORD '${hash}'`);
    } else {
      await prisma.$executeRawUnsafe(`CREATE ROLE ${SQL_READER_USER} WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT PASSWORD '${hash}'`);
    }
    // Miembro sólo del rol lector: cualquier otra membresía se quita.
    const others = await prisma.$queryRaw<{ role: string }[]>`
      SELECT r.rolname AS role FROM pg_auth_members m
      JOIN pg_roles r ON r.oid = m.roleid JOIN pg_roles u ON u.oid = m.member
      WHERE u.rolname = ${SQL_READER_USER} AND r.rolname <> ${READER_ROLE}`;
    for (const o of others) {
      if (/^[a-z_][a-z0-9_]*$/.test(o.role)) await prisma.$executeRawUnsafe(`REVOKE "${o.role}" FROM ${SQL_READER_USER}`);
    }
    await prisma.$executeRawUnsafe(`GRANT ${READER_ROLE} TO ${SQL_READER_USER}`);
    await prisma.$executeRawUnsafe(`ALTER ROLE ${SQL_READER_USER} SET default_transaction_read_only = on`);
    await prisma.$executeRawUnsafe(`ALTER ROLE ${SQL_READER_USER} SET statement_timeout = '20s'`);
  } catch (err: any) {
    console.warn(
      `[mcp] no se pudo crear el usuario ${SQL_READER_USER} (¿el usuario de la base puede crear roles?); consulta_sql queda desactivada:`,
      err?.message || err,
    );
    return;
  }

  // Prueba real con el usuario nuevo antes de habilitar la herramienta.
  const url = buildReaderUrl(process.env.DATABASE_URL || "", password);
  const probe = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const who = await probe.$queryRaw<{ u: string }[]>`SELECT current_user AS u`;
    if (who[0]?.u !== SQL_READER_USER) throw new Error(`conectó como ${who[0]?.u}`);
    enableSqlReader(url);
    console.log(`[mcp] consulta_sql habilitada con el usuario de sólo lectura ${SQL_READER_USER}.`);
  } catch (err: any) {
    console.warn(`[mcp] el usuario ${SQL_READER_USER} no pudo conectarse; consulta_sql queda desactivada:`, err?.message || err);
  } finally {
    await probe.$disconnect().catch(() => {});
  }
}
