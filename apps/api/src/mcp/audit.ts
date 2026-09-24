import { prisma } from "../db";
import { errorResult, type ToolResult } from "./helpers";

/** "full" = lectura + acciones; "read" = sólo lectura. */
export type McpScope = "full" | "read";

/** Quién está llamando: sale del token OAuth validado en cada request. */
export type McpContext = {
  scope: McpScope;
  userId: string;
  email: string;
  clientId: string;
  tokenId: string;
  ip: string | null;
};

const MAX_ARGS_CHARS = 20_000;

function trimArgs(args: unknown): unknown {
  if (args === undefined) return undefined;
  try {
    const text = JSON.stringify(args);
    return text.length > MAX_ARGS_CHARS ? { truncado: text.slice(0, MAX_ARGS_CHARS) } : args;
  } catch {
    return undefined;
  }
}

export async function writeAudit(entry: {
  tool: string;
  scope: string;
  userId?: string | null;
  clientId?: string | null;
  ip?: string | null;
  args?: unknown;
  ok: boolean;
  error?: string;
}) {
  await prisma.mcpAuditLog
    .create({
      data: {
        tool: entry.tool,
        scope: entry.scope,
        userId: entry.userId ?? null,
        clientId: entry.clientId ?? null,
        ip: entry.ip ?? null,
        args: trimArgs(entry.args) as any,
        ok: entry.ok,
        error: entry.error?.slice(0, 2000),
      },
    })
    .catch((err) => console.error("[mcp] no se pudo escribir la bitácora:", err?.message || err));
}

/**
 * Envuelve el handler de una herramienta: toda llamada queda en la bitácora
 * (quién, desde qué cliente e IP, con qué argumentos y si salió bien), y los
 * errores vuelven como resultado de herramienta sin detalles internos.
 */
export function guarded<A>(tool: string, ctx: McpContext, handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    const base = { tool, scope: ctx.scope, userId: ctx.userId, clientId: ctx.clientId, ip: ctx.ip, args };
    try {
      const result = await handler(args);
      await writeAudit({ ...base, ok: !result.isError, error: result.isError ? result.content[0]?.text : undefined });
      return result;
    } catch (err: any) {
      const message = err?.message || String(err);
      console.error(JSON.stringify({ level: "error", source: "mcp", tool, message }));
      await writeAudit({ ...base, ok: false, error: message });
      // El detalle (consultas, nombres internos) queda en la bitácora, no en la respuesta.
      return errorResult(`Error en ${tool}. Quedó registrado en la bitácora.`);
    }
  };
}
