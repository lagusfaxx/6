import express, { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { createHash, timingSafeEqual } from "crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./server";
import type { McpScope } from "./audit";

/**
 * Servidor MCP para conectar Claude (claude.ai, Claude Desktop o Claude Code)
 * al panel de UZEED. Ver docs/MCP.md.
 *
 * Autenticación por token fijo, dos niveles:
 *  - MCP_TOKEN: todo (lecturas + acciones).
 *  - MCP_READ_TOKEN: sólo lecturas.
 * El token va en `Authorization: Bearer <token>` o en la ruta `/mcp/<token>`
 * (esto último es para los conectores personalizados de claude.ai, que no
 * permiten cabeceras). Sin ningún token configurado, /mcp responde 404.
 *
 * Se monta antes de CORS, sesión y `requireAuth`: no usa cookies y la
 * llamada llega servidor a servidor.
 */
export const mcpRouter = Router();

const MIN_TOKEN_LENGTH = 32;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

function configuredTokens(): { token: Buffer; scope: McpScope }[] {
  const out: { token: Buffer; scope: McpScope }[] = [];
  const full = process.env.MCP_TOKEN?.trim();
  const read = process.env.MCP_READ_TOKEN?.trim();
  if (full && full.length >= MIN_TOKEN_LENGTH) out.push({ token: digest(full), scope: "full" });
  if (read && read.length >= MIN_TOKEN_LENGTH) out.push({ token: digest(read), scope: "read" });
  return out;
}

const tokens = configuredTokens();
if (process.env.MCP_TOKEN && !tokens.some((t) => t.scope === "full")) {
  console.warn(`[mcp] MCP_TOKEN ignorado: debe tener al menos ${MIN_TOKEN_LENGTH} caracteres.`);
}
if (process.env.MCP_READ_TOKEN && !tokens.some((t) => t.scope === "read")) {
  console.warn(`[mcp] MCP_READ_TOKEN ignorado: debe tener al menos ${MIN_TOKEN_LENGTH} caracteres.`);
}

function resolveScope(req: Request): McpScope | null {
  const header = req.header("authorization") || "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const candidate = bearer || String(req.params.token || "");
  if (!candidate) return null;
  const hashed = digest(candidate);
  // Se comparan todos para no filtrar por tiempo cuál coincidió.
  let scope: McpScope | null = null;
  for (const entry of tokens) {
    if (timingSafeEqual(hashed, entry.token)) scope = scope === "full" ? scope : entry.scope;
  }
  return scope;
}

function jsonRpcError(res: Response, status: number, message: string) {
  return res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

async function handleMcp(req: Request, res: Response) {
  if (!tokens.length) return res.status(404).json({ error: "MCP_DISABLED" });

  const scope = resolveScope(req);
  if (!scope) return jsonRpcError(res, 401, "Token inválido o ausente.");

  // Modo sin estado: cada POST trae su propio intercambio completo, así
  // funciona igual con varias réplicas de la API y reinicios.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonRpcError(res, 405, "Método no permitido.");
  }

  const server = buildMcpServer(scope);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    // No se loguea la URL: puede llevar el token.
    console.error(JSON.stringify({ level: "error", source: "mcp", message: err?.message || String(err) }));
    if (!res.headersSent) jsonRpcError(res, 500, "Error interno del servidor MCP.");
  }
}

const mcpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
});

const parseJson = express.json({ limit: "1mb" });

// El error de parseo se responde acá: si llegara al manejador global, éste
// loguea la URL y con ella el token.
function mcpJson(req: Request, res: Response, next: express.NextFunction) {
  parseJson(req, res, (err?: unknown) => (err ? jsonRpcError(res, 400, "JSON inválido.") : next()));
}

mcpRouter.all("/mcp", mcpLimiter, mcpJson, handleMcp);
mcpRouter.all("/mcp/:token", mcpLimiter, mcpJson, handleMcp);
