import { prisma } from "../db";
import { mcpEnabled } from "./oauth/config";

/**
 * Vuelve a calcular qué columnas puede leer `uzeed_mcp_reader` (la función
 * vive en la migración mcp_oauth_hardening). Así una tabla o columna nueva
 * queda visible para consulta_sql sólo si no es sensible por nombre. Si
 * falla (sin permisos, sin rol), consulta_sql sigue viendo lo de antes o
 * nada: nunca más.
 */
export async function refreshMcpReaderGrants() {
  if (!mcpEnabled()) return;
  try {
    const rows = await prisma.$queryRaw<{ r: string }[]>`SELECT mcp_reader_refresh_grants() AS r`;
    if (rows[0]?.r !== "ok") console.warn(`[mcp] rol lector: ${rows[0]?.r}`);
  } catch (err: any) {
    console.warn("[mcp] no se pudieron refrescar los permisos del rol lector:", err?.message || err);
  }
}
