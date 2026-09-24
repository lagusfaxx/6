import { PrismaClient } from "@prisma/client";

/**
 * Conexión exclusiva de `consulta_sql`, con un usuario de base de datos que
 * sólo es miembro de `uzeed_mcp_reader` (ver docs/MCP.md). No basta con
 * `SET ROLE` sobre la conexión principal: con SQL dinámico se puede volver al
 * rol de la sesión, que es el dueño de todo. Con un usuario propio no hay a
 * qué volver.
 *
 * Sin `MCP_SQL_DATABASE_URL` la herramienta no se registra (falla cerrada).
 * Máximo 2 conexiones: además es el tope de consultas libres simultáneas, para
 * que nadie sature la base de una app con mucho tráfico.
 */
let client: PrismaClient | null = null;

export function sqlReaderConfigured(): boolean {
  return Boolean(process.env.MCP_SQL_DATABASE_URL);
}

export function sqlReader(): PrismaClient {
  if (!client) {
    const base = process.env.MCP_SQL_DATABASE_URL!;
    const url = base + (base.includes("?") ? "&" : "?") + "connection_limit=2&pool_timeout=10";
    client = new PrismaClient({ datasources: { db: { url } }, log: ["error"] });
  }
  return client;
}
