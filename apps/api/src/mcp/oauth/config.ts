import { config } from "../../config";

/**
 * Parámetros del servidor OAuth 2.1 del MCP.
 *
 * Todo el MCP está apagado salvo `MCP_ENABLED=true`: si alguien olvida
 * configurarlo, falla cerrado.
 */
export function mcpEnabled(): boolean {
  return process.env.MCP_ENABLED === "true";
}

/** Emisor (issuer) y base de las URLs públicas: la API, sin barra final. */
export const ISSUER = config.apiUrl.replace(/\/+$/, "");
export const RESOURCE_URL = `${ISSUER}/mcp`;
export const ISSUER_ORIGIN = new URL(ISSUER).origin;

export const OAUTH_PATHS = {
  authorize: "/mcp-oauth/authorize",
  token: "/mcp-oauth/token",
  register: "/mcp-oauth/register",
  revoke: "/mcp-oauth/revoke",
} as const;

export const SCOPE_READ = "mcp:read";
export const SCOPE_WRITE = "mcp:write";
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE];

/** Vidas útiles. La familia de tokens vence sí o sí: después, 2FA otra vez. */
export const TTL = {
  code: 5 * 60 * 1000,
  access: 60 * 60 * 1000,
  refresh: 7 * 24 * 60 * 60 * 1000,
  family: 30 * 24 * 60 * 60 * 1000,
  consent: 10 * 60 * 1000,
};

/** Redirecciones de claude.ai / claude.com. Se comparan exactas. */
const DEFAULT_REDIRECTS = [
  "https://claude.ai/api/mcp/auth_callback",
  "https://claude.com/api/mcp/auth_callback",
];

function extraRedirects(): string[] {
  return (process.env.MCP_OAUTH_REDIRECT_URIS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Claude Code (y Desktop) reciben el código en un puerto local. */
function loopbackAllowed(): boolean {
  return process.env.MCP_OAUTH_ALLOW_LOOPBACK !== "false";
}

export function isLoopbackRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    return u.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  } catch {
    return false;
  }
}

/** ¿Se puede registrar/usar esta redirección? Sin fragmentos, sin credenciales en la URL. */
export function isAllowedRedirect(uri: string): boolean {
  if (typeof uri !== "string" || uri.length > 500) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if ([...DEFAULT_REDIRECTS, ...extraRedirects()].includes(uri)) return true;
  return loopbackAllowed() && isLoopbackRedirect(uri);
}
