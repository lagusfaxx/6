import { PrismaClient } from "@prisma/client";

/**
 * Conexión exclusiva de `consulta_sql`, con el usuario `uzeed_mcp_sql`, que
 * sólo es miembro de `uzeed_mcp_reader`. No basta con `SET ROLE` sobre la
 * conexión principal: con SQL dinámico se puede volver al rol de la sesión,
 * que es el dueño de todo. Con un usuario propio no hay a qué volver.
 *
 * La API crea ese usuario sola al arrancar (ver boot.ts) con la clave de
 * `MCP_SQL_PASSWORD`, y arma la conexión a partir de `DATABASE_URL`. Hasta
 * que eso termina bien, la herramienta no se registra (falla cerrada).
 *
 * Máximo 2 conexiones: además es el tope de consultas libres simultáneas,
 * para que nadie sature la base de una app con mucho tráfico.
 */
export const SQL_READER_USER = "uzeed_mcp_sql";

let readerUrl: string | null = null;
let client: PrismaClient | null = null;

/** Arma la URL del lector: la misma base y host que DATABASE_URL, otro usuario. */
export function buildReaderUrl(databaseUrl: string, password: string): string {
  const url = new URL(databaseUrl);
  url.username = SQL_READER_USER;
  url.password = password;
  url.searchParams.delete("connection_limit");
  url.searchParams.delete("pool_timeout");
  url.searchParams.set("connection_limit", "2");
  url.searchParams.set("pool_timeout", "10");
  return url.toString();
}

/** Lo llama boot.ts cuando el usuario existe y la conexión respondió. */
export function enableSqlReader(url: string) {
  readerUrl = url;
}

export function sqlReaderConfigured(): boolean {
  return readerUrl !== null;
}

export function sqlReader(): PrismaClient {
  if (!readerUrl) throw new Error("consulta_sql no está habilitada");
  // Sin log de errores: los de esta conexión son de consultas que escribió
  // Claude (columna mal escrita, valor de enum) y ya vuelven explicados en la
  // respuesta y quedan en la bitácora; en el log de la API sólo eran ruido.
  if (!client) client = new PrismaClient({ datasources: { db: { url: readerUrl } }, log: [] });
  return client;
}
