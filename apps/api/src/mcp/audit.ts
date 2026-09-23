import { prisma } from "../db";
import { errorResult, type ToolResult } from "./helpers";

export type McpScope = "full" | "read";

async function writeAudit(entry: {
  tool: string;
  scope: McpScope;
  args: unknown;
  ok: boolean;
  error?: string;
}) {
  await prisma.mcpAuditLog
    .create({
      data: {
        tool: entry.tool,
        scope: entry.scope,
        args: (entry.args ?? undefined) as any,
        ok: entry.ok,
        error: entry.error?.slice(0, 2000),
      },
    })
    .catch((err) => console.error("[mcp] no se pudo escribir la bitácora:", err?.message || err));
}

/**
 * Envuelve el handler de una herramienta: atrapa errores para devolverlos
 * como resultado de herramienta (Claude los ve y puede corregir la llamada)
 * y, si `audit` es true, deja la llamada en la bitácora.
 */
export function guarded<A>(
  tool: string,
  scope: McpScope,
  handler: (args: A) => Promise<ToolResult>,
  opts: { audit?: boolean } = {},
) {
  return async (args: A): Promise<ToolResult> => {
    try {
      const result = await handler(args);
      if (opts.audit) {
        await writeAudit({ tool, scope, args, ok: !result.isError, error: result.isError ? result.content[0]?.text : undefined });
      }
      return result;
    } catch (err: any) {
      const message = err?.message || String(err);
      console.error(JSON.stringify({ level: "error", source: "mcp", tool, message }));
      if (opts.audit) await writeAudit({ tool, scope, args, ok: false, error: message });
      return errorResult(`Error en ${tool}: ${message}`);
    }
  };
}
