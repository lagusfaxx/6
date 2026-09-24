import express, { Router, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { BlockList, isIP } from "net";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./server";
import { writeAudit, type McpContext } from "./audit";
import { ISSUER, SCOPE_WRITE, mcpEnabled } from "./oauth/config";
import { validateAccessToken } from "./oauth/store";

/**
 * Servidor MCP para Claude (claude.ai, Desktop o Claude Code). Ver docs/MCP.md.
 *
 * Capas de protección, de afuera hacia adentro:
 *  1. Apagado salvo MCP_ENABLED=true.
 *  2. Allowlist de IPs opcional (MCP_ALLOWED_IPS).
 *  3. Bloqueo de la IP tras repetidos tokens inválidos.
 *  4. Sólo tokens OAuth en `Authorization: Bearer` (nunca en la URL), que se
 *     revalidan en cada llamada contra la base y la cuenta (rol + 2FA).
 *  5. Límite de llamadas por token.
 *  6. Herramientas de escritura sólo con scope mcp:write (administrador).
 *  7. Cada llamada queda en la bitácora.
 *
 * Se monta antes de CORS y de la sesión: no usa cookies.
 */
export const mcpRouter = Router();

const RESOURCE_METADATA = `${ISSUER}/.well-known/oauth-protected-resource/mcp`;

// ── Allowlist de IPs (opcional) ────────────────────────────────────────────
function buildAllowlist(): BlockList | null {
  const raw = (process.env.MCP_ALLOWED_IPS || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!raw.length) return null;
  const list = new BlockList();
  for (const entry of raw) {
    const [addr, prefix] = entry.split("/");
    const type = isIP(addr) === 6 ? "ipv6" : "ipv4";
    if (!isIP(addr)) {
      console.warn(`[mcp] MCP_ALLOWED_IPS: "${entry}" no es una IP válida, se ignora.`);
      continue;
    }
    if (prefix) list.addSubnet(addr, Number(prefix), type);
    else list.addAddress(addr, type);
  }
  return list;
}
const allowlist = buildAllowlist();

function ipAllowed(ip: string | undefined): boolean {
  if (!allowlist) return true;
  if (!ip) return false;
  const plain = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  const type = isIP(plain) === 6 ? "ipv6" : "ipv4";
  return isIP(plain) ? allowlist.check(plain, type) : false;
}

// ── Bloqueo por intentos fallidos ─────────────────────────────────────────
const FAIL_WINDOW = 10 * 60 * 1000;
const FAIL_LIMIT = 20;
const BLOCK_FOR = 30 * 60 * 1000;
const failures = new Map<string, { count: number; since: number; blockedUntil: number }>();

function isBlocked(ip: string): boolean {
  const entry = failures.get(ip);
  return Boolean(entry && entry.blockedUntil > Date.now());
}

function registerFailure(ip: string) {
  const now = Date.now();
  if (failures.size > 10_000) {
    for (const [key, v] of failures) if (v.blockedUntil < now && now - v.since > FAIL_WINDOW) failures.delete(key);
  }
  const entry = failures.get(ip);
  if (!entry || now - entry.since > FAIL_WINDOW) {
    failures.set(ip, { count: 1, since: now, blockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= FAIL_LIMIT && entry.blockedUntil < now) {
    entry.blockedUntil = now + BLOCK_FOR;
    console.warn(JSON.stringify({ level: "warn", source: "mcp", event: "ip_bloqueada", ip }));
    writeAudit({ tool: "mcp_ip_bloqueada", scope: "auth", ip, ok: false, args: { intentos: entry.count } }).catch(() => {});
  }
}

function jsonRpcError(res: Response, status: number, message: string) {
  return res.status(status).json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
}

function unauthorized(res: Response, error: "invalid_token" | undefined) {
  res.setHeader(
    "WWW-Authenticate",
    `Bearer resource_metadata="${RESOURCE_METADATA}"${error ? `, error="${error}"` : ""}`,
  );
  return jsonRpcError(res, 401, "Autorización requerida.");
}

// ── Pipeline ──────────────────────────────────────────────────────────────
function gate(req: Request, res: Response, next: NextFunction) {
  if (!mcpEnabled()) return res.status(404).json({ error: "MCP_DISABLED" });
  const ip = req.ip || "desconocida";
  if (!ipAllowed(req.ip)) return res.status(403).json({ error: "FORBIDDEN" });
  if (isBlocked(ip)) return jsonRpcError(res, 429, "Demasiados intentos fallidos. Intenta más tarde.");
  return next();
}

async function authenticate(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || "desconocida";
  const header = req.header("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    // Sin credencial: es el primer paso normal del flujo OAuth, no cuenta como fallo.
    return unauthorized(res, undefined);
  }
  try {
    const access = await validateAccessToken(header.slice(7).trim(), req.ip);
    if (!access) {
      registerFailure(ip);
      return unauthorized(res, "invalid_token");
    }
    const ctx: McpContext = {
      scope: access.scopes.includes(SCOPE_WRITE) ? "full" : "read",
      userId: access.userId,
      email: access.email,
      clientId: access.clientId,
      tokenId: access.tokenId,
      ip: req.ip || null,
    };
    (req as any).mcp = ctx;
    return next();
  } catch (err: any) {
    console.error(JSON.stringify({ level: "error", source: "mcp", message: err?.message || String(err) }));
    return jsonRpcError(res, 500, "Error interno del servidor MCP.");
  }
}

/** Límite por token (no por IP): los servidores de Claude comparten IPs. */
const perTokenLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).mcp?.tokenId || req.ip || "anon",
  message: { jsonrpc: "2.0", error: { code: -32000, message: "Demasiadas llamadas. Espera un minuto." }, id: null },
});

/** Tope global por IP antes de autenticar, contra ráfagas. */
const perIpLimiter = rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });

const parseJson = express.json({ limit: "256kb" });
function mcpJson(req: Request, res: Response, next: NextFunction) {
  parseJson(req, res, (err?: unknown) => (err ? jsonRpcError(res, 400, "JSON inválido.") : next()));
}

async function handleMcp(req: Request, res: Response) {
  // Sin estado: cada POST es un intercambio completo; funciona con réplicas.
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return jsonRpcError(res, 405, "Método no permitido.");
  }
  const ctx = (req as any).mcp as McpContext;
  const server = buildMcpServer(ctx);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error(JSON.stringify({ level: "error", source: "mcp", message: err?.message || String(err) }));
    if (!res.headersSent) jsonRpcError(res, 500, "Error interno del servidor MCP.");
  }
}

mcpRouter.all("/mcp", gate, perIpLimiter, authenticate, perTokenLimiter, mcpJson, handleMcp);
// Rutas antiguas con token en la URL: ya no existen y no se revela nada.
mcpRouter.all("/mcp/*", (_req, res) => res.status(404).json({ error: "NOT_FOUND" }));
