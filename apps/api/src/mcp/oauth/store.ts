import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import { prisma } from "../../db";
import { config } from "../../config";
import { SCOPE_READ, SCOPE_WRITE, TTL } from "./config";

/**
 * Tokens y códigos del OAuth del MCP. En la base sólo quedan hashes SHA-256:
 * quien lea la tabla no puede usar lo que ve. Los valores llevan prefijo
 * para que los escáneres de secretos los reconozcan si se filtran.
 */

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string): string {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** PKCE S256: base64url(sha256(verifier)) debe ser el challenge. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return safeEqual(computed, challenge);
}

export type Staff = {
  id: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  twoFactorLastUsedStep: bigint | null;
};

export function isOwnerAdmin(user: { email: string; role: string }): boolean {
  return user.role === "ADMIN" || user.email === config.adminEmail;
}

/**
 * Qué alcance puede recibir esta cuenta: escritura sólo el administrador,
 * lectura también el equipo. Sin 2FA activo, nada.
 */
export function maxScopeFor(user: { email: string; role: string; twoFactorEnabled: boolean }): string[] {
  if (!user.twoFactorEnabled) return [];
  if (isOwnerAdmin(user)) return [SCOPE_READ, SCOPE_WRITE];
  if (user.role === "MODERATOR") return [SCOPE_READ];
  return [];
}

/** Recorta lo pedido a lo permitido. Si no pidió nada, recibe lo máximo que le corresponde. */
export function grantScope(requested: string | undefined, allowed: string[]): string[] {
  const asked = (requested || "").split(/\s+/).filter(Boolean);
  const wanted = asked.length ? asked : allowed;
  const granted = wanted.filter((s) => allowed.includes(s));
  // Escribir implica leer.
  if (granted.includes(SCOPE_WRITE) && !granted.includes(SCOPE_READ)) granted.unshift(SCOPE_READ);
  return granted;
}

export async function loadStaff(userId: string): Promise<Staff | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorLastUsedStep: true,
    },
  }) as Promise<Staff | null>;
}

export async function createAuthCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource?: string;
}): Promise<string> {
  const code = randomToken("uzmcp_code_");
  await prisma.mcpOAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scope: input.scope,
      resource: input.resource ?? null,
      expiresAt: new Date(Date.now() + TTL.code),
    },
  });
  // Limpieza oportunista de códigos vencidos.
  prisma.mcpOAuthCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - TTL.code) } } }).catch(() => {});
  return code;
}

/** Marca el código como usado de forma atómica: sólo una llamada gana. */
export async function consumeAuthCode(code: string) {
  const codeHash = sha256(code);
  const row = await prisma.mcpOAuthCode.findUnique({ where: { codeHash } });
  if (!row) return { ok: false as const, reason: "unknown" };
  if (row.usedAt) return { ok: false as const, reason: "reused", row };
  if (row.expiresAt < new Date()) return { ok: false as const, reason: "expired", row };
  const claimed = await prisma.mcpOAuthCode.updateMany({
    where: { codeHash, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false as const, reason: "reused", row };
  return { ok: true as const, row };
}

export type IssuedTokens = {
  access_token: string;
  refresh_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
};

export async function issueTokens(input: {
  clientId: string;
  userId: string;
  scope: string;
  familyId?: string;
  familyExpiresAt?: Date;
  ip?: string;
}): Promise<IssuedTokens> {
  const now = Date.now();
  const access = randomToken("uzmcp_at_");
  const refresh = randomToken("uzmcp_rt_");
  const familyExpiresAt = input.familyExpiresAt ?? new Date(now + TTL.family);
  await prisma.mcpOAuthToken.create({
    data: {
      familyId: input.familyId ?? randomUUID(),
      clientId: input.clientId,
      userId: input.userId,
      scope: input.scope,
      accessHash: sha256(access),
      refreshHash: sha256(refresh),
      accessExpiresAt: new Date(Math.min(now + TTL.access, familyExpiresAt.getTime())),
      refreshExpiresAt: new Date(Math.min(now + TTL.refresh, familyExpiresAt.getTime())),
      familyExpiresAt,
      lastIp: input.ip ?? null,
    },
  });
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: "Bearer",
    expires_in: Math.floor(TTL.access / 1000),
    scope: input.scope,
  };
}

export async function revokeFamily(familyId: string, reason: string) {
  await prisma.mcpOAuthToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export type ValidatedAccess = {
  tokenId: string;
  familyId: string;
  clientId: string;
  userId: string;
  email: string;
  scopes: string[];
};

/**
 * Valida un access token en cada llamada a /mcp. Además de vigencia y
 * revocación, vuelve a mirar la cuenta: si le quitaron el rol o apagó el 2FA,
 * el token deja de servir en ese mismo momento.
 */
export async function validateAccessToken(token: string, ip?: string): Promise<ValidatedAccess | null> {
  if (!token.startsWith("uzmcp_at_") || token.length > 200) return null;
  const row = await prisma.mcpOAuthToken.findUnique({ where: { accessHash: sha256(token) } });
  const now = new Date();
  if (!row || row.revokedAt || row.rotatedAt) return null;
  if (row.accessExpiresAt <= now || row.familyExpiresAt <= now) return null;

  const user = await loadStaff(row.userId);
  if (!user) return null;
  const allowed = maxScopeFor(user);
  const scopes = row.scope.split(" ").filter((s) => allowed.includes(s));
  if (!scopes.includes(SCOPE_READ)) return null;

  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > 60_000 || row.lastIp !== (ip ?? null)) {
    prisma.mcpOAuthToken
      .update({ where: { id: row.id }, data: { lastUsedAt: now, lastIp: ip ?? null } })
      .catch(() => {});
  }
  return { tokenId: row.id, familyId: row.familyId, clientId: row.clientId, userId: user.id, email: user.email, scopes };
}
