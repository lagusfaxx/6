import express, { Router, type Request, type RequestHandler, type Response } from "express";
import rateLimit from "express-rate-limit";
import { randomBytes } from "crypto";
import { prisma } from "../../db";
import { config } from "../../config";
import { verifyTotp } from "../../auth/totp";
import { emitAdminEvent } from "../../lib/adminEvents";
import { writeAudit } from "../audit";
import {
  ISSUER,
  ISSUER_ORIGIN,
  OAUTH_PATHS,
  RESOURCE_URL,
  SUPPORTED_SCOPES,
  TTL,
  isAllowedRedirect,
  isLoopbackRedirect,
  mcpEnabled,
} from "./config";
import { consentPage, errorPage, loginRequiredPage, twoFactorRequiredPage } from "./consent";
import {
  consumeAuthCode,
  createAuthCode,
  grantScope,
  issueTokens,
  loadStaff,
  maxScopeFor,
  revokeFamily,
  safeEqual,
  sha256,
  verifyPkce,
} from "./store";

/**
 * Servidor de autorización OAuth 2.1 del MCP (RFC 8414, 7591, 7636, 7009,
 * 9728). Flujo: Claude registra su cliente → abre /authorize en el navegador
 * del admin → el admin, con sesión iniciada en UZEED y 2FA verificado,
 * aprueba ingresando un código TOTP vigente → Claude canjea el código con
 * PKCE por tokens de 1 hora, que se refrescan rotando hasta 30 días.
 */

const MAX_CLIENTS = 500;
const MAX_CONSENT_ATTEMPTS = 5;

type PendingConsent = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope: string;
  resource?: string;
  expiresAt: number;
  attempts: number;
};

function clientIp(req: Request): string | null {
  return req.ip || null;
}

function noStore(res: Response) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
}

/** Cabeceras de las páginas HTML: sin marcos, sin recursos externos, sin Referer. */
function htmlHeaders(res: Response, formTarget?: string) {
  noStore(res);
  const formAction = ["'self'", formTarget].filter(Boolean).join(" ");
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'none'; style-src 'unsafe-inline'; form-action ${formAction}; frame-ancestors 'none'; base-uri 'none'`,
  );
  res.setHeader("X-Frame-Options", "DENY");
  // same-origin y no no-referrer: con no-referrer el navegador manda
  // `Origin: null` al enviar el formulario y el chequeo de origen lo rechaza.
  // Hacia afuera (claude.ai) igual no viaja ningún Referer.
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function oauthError(res: Response, status: number, error: string, description?: string) {
  noStore(res);
  return res.status(status).json({ error, ...(description ? { error_description: description } : {}) });
}

function redirectWith(res: Response, redirectUri: string, params: Record<string, string | undefined>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  url.searchParams.set("iss", ISSUER);
  noStore(res);
  return res.redirect(302, url.toString());
}

function pendingStore(req: Request): Record<string, PendingConsent> {
  const session = req.session as any;
  if (!session.mcpConsent) session.mcpConsent = {};
  const store = session.mcpConsent as Record<string, PendingConsent>;
  const now = Date.now();
  for (const [id, p] of Object.entries(store)) if (p.expiresAt < now) delete store[id];
  // Pocas solicitudes abiertas a la vez por sesión.
  const ids = Object.keys(store);
  if (ids.length > 5) for (const id of ids.slice(0, ids.length - 5)) delete store[id];
  return store;
}

function saveSession(req: Request) {
  return new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}

async function findClient(clientId: unknown) {
  if (typeof clientId !== "string" || clientId.length > 100) return null;
  return prisma.mcpOAuthClient.findUnique({ where: { id: clientId } });
}

/** Cliente confidencial: su secreto debe venir y coincidir. Público: nada. */
function clientAuthenticated(req: Request, client: { secretHash: string | null }): boolean {
  if (!client.secretHash) return true;
  let secret = typeof req.body?.client_secret === "string" ? req.body.client_secret : "";
  const header = req.header("authorization") || "";
  if (!secret && header.toLowerCase().startsWith("basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    secret = decodeURIComponent(decoded.slice(decoded.indexOf(":") + 1));
  }
  return Boolean(secret) && safeEqual(sha256(secret), client.secretHash);
}

const limiter = (windowMs: number, limit: number) =>
  rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false, message: { error: "slow_down" } });

export function createMcpOAuthRouter(sessionMiddleware: RequestHandler): Router {
  const router = Router();
  const form = express.urlencoded({ extended: false, limit: "20kb" });
  const json = express.json({ limit: "20kb" });

  // Si el MCP está apagado, nada de esto existe.
  router.use((req, res, next) => {
    const path = req.path;
    const ours = path.startsWith("/mcp-oauth/") || path.startsWith("/.well-known/oauth-");
    if (ours && !mcpEnabled()) return res.status(404).json({ error: "MCP_DISABLED" });
    return next();
  });

  // ── Metadatos ────────────────────────────────────────────────────────────
  const protectedResource = (_req: Request, res: Response) =>
    res.json({
      resource: RESOURCE_URL,
      authorization_servers: [ISSUER],
      scopes_supported: SUPPORTED_SCOPES,
      bearer_methods_supported: ["header"],
      resource_name: "UZEED",
    });
  router.get("/.well-known/oauth-protected-resource", protectedResource);
  router.get("/.well-known/oauth-protected-resource/mcp", protectedResource);

  const asMetadata = (_req: Request, res: Response) =>
    res.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}${OAUTH_PATHS.authorize}`,
      token_endpoint: `${ISSUER}${OAUTH_PATHS.token}`,
      registration_endpoint: `${ISSUER}${OAUTH_PATHS.register}`,
      revocation_endpoint: `${ISSUER}${OAUTH_PATHS.revoke}`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
      scopes_supported: SUPPORTED_SCOPES,
      authorization_response_iss_parameter_supported: true,
    });
  router.get("/.well-known/oauth-authorization-server", asMetadata);
  router.get("/.well-known/oauth-authorization-server/mcp", asMetadata);

  // ── Registro dinámico de clientes (RFC 7591) ─────────────────────────────
  router.post(OAUTH_PATHS.register, limiter(60 * 60 * 1000, 20), json, async (req, res) => {
    try {
      const body = req.body || {};
      const redirectUris: unknown = body.redirect_uris;
      if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 5) {
        return oauthError(res, 400, "invalid_redirect_uri", "redirect_uris requerido (1 a 5).");
      }
      const bad = redirectUris.find((u) => !isAllowedRedirect(String(u)));
      if (bad !== undefined) {
        await writeAudit({ tool: "oauth_register_rechazado", scope: "auth", ip: clientIp(req), args: { redirectUris }, ok: false });
        return oauthError(res, 400, "invalid_redirect_uri", "Redirección no permitida.");
      }
      const grants: string[] = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code", "refresh_token"];
      if (grants.some((g) => !["authorization_code", "refresh_token"].includes(g))) {
        return oauthError(res, 400, "invalid_client_metadata", "grant_types no soportado.");
      }
      const authMethod = body.token_endpoint_auth_method || "none";
      if (!["none", "client_secret_post", "client_secret_basic"].includes(authMethod)) {
        return oauthError(res, 400, "invalid_client_metadata", "token_endpoint_auth_method no soportado.");
      }

      // Tope de clientes: se barren los que nunca obtuvieron un token.
      if ((await prisma.mcpOAuthClient.count()) >= MAX_CLIENTS) {
        await prisma.mcpOAuthClient.deleteMany({
          where: { tokens: { none: {} }, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        });
        if ((await prisma.mcpOAuthClient.count()) >= MAX_CLIENTS) {
          return oauthError(res, 503, "temporarily_unavailable", "Demasiados clientes registrados.");
        }
      }

      const name = String(body.client_name || "Cliente MCP")
        .replace(/[\u0000-\u001f\u007f<>]/g, "")
        .slice(0, 80);
      const clientId = `uzmcp_client_${randomBytes(16).toString("base64url")}`;
      const secret = authMethod === "none" ? null : `uzmcp_cs_${randomBytes(32).toString("base64url")}`;
      await prisma.mcpOAuthClient.create({
        data: { id: clientId, name, redirectUris: redirectUris.map(String), secretHash: secret ? sha256(secret) : null },
      });
      await writeAudit({ tool: "oauth_register", scope: "auth", clientId, ip: clientIp(req), args: { name, redirectUris }, ok: true });
      noStore(res);
      return res.status(201).json({
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_name: name,
        redirect_uris: redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: authMethod,
        ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      });
    } catch (err: any) {
      console.error("[mcp-oauth] register:", err?.message);
      return oauthError(res, 500, "server_error");
    }
  });

  // ── Autorización: pantalla de consentimiento ────────────────────────────
  router.get(OAUTH_PATHS.authorize, limiter(15 * 60 * 1000, 60), sessionMiddleware, async (req, res) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const client = await findClient(q.client_id);
      // Errores de cliente o redirección se muestran acá: nunca se redirige a
      // una URL que no esté registrada.
      if (!client) {
        htmlHeaders(res);
        return res.status(400).send(errorPage("Aplicación desconocida."));
      }
      const redirectUri = String(q.redirect_uri || "");
      if (!client.redirectUris.includes(redirectUri) || !isAllowedRedirect(redirectUri)) {
        htmlHeaders(res);
        return res.status(400).send(errorPage("La dirección de retorno no coincide con la registrada."));
      }
      const state = typeof q.state === "string" ? q.state.slice(0, 500) : undefined;
      if (q.response_type !== "code") return redirectWith(res, redirectUri, { error: "unsupported_response_type", state });
      if (q.code_challenge_method !== "S256" || !/^[A-Za-z0-9\-_]{43}$/.test(q.code_challenge || "")) {
        return redirectWith(res, redirectUri, { error: "invalid_request", error_description: "PKCE S256 obligatorio.", state });
      }
      if (q.resource && q.resource.replace(/\/+$/, "") !== RESOURCE_URL && q.resource.replace(/\/+$/, "") !== ISSUER) {
        return redirectWith(res, redirectUri, { error: "invalid_target", state });
      }

      const retryUrl = `${ISSUER}${req.originalUrl}`;
      const userId = req.session?.userId;
      const formTarget = new URL(redirectUri).origin;
      if (!userId || (req.session as any).twoFactorPending) {
        htmlHeaders(res, formTarget);
        return res.status(401).send(loginRequiredPage(config.appUrl.replace(/\/+$/, ""), retryUrl));
      }
      const user = await loadStaff(userId);
      if (!user || (!["ADMIN", "MODERATOR"].includes(user.role) && user.email !== config.adminEmail)) {
        htmlHeaders(res, formTarget);
        return res.status(403).send(errorPage("Tu cuenta no tiene acceso al panel de administración."));
      }
      const allowed = maxScopeFor(user);
      if (!allowed.length) {
        htmlHeaders(res, formTarget);
        return res.status(403).send(twoFactorRequiredPage());
      }
      const scopes = grantScope(q.scope, allowed);
      if (!scopes.length) return redirectWith(res, redirectUri, { error: "invalid_scope", state });

      const requestId = randomBytes(24).toString("base64url");
      pendingStore(req)[requestId] = {
        clientId: client.id,
        redirectUri,
        codeChallenge: q.code_challenge!,
        state,
        scope: scopes.join(" "),
        resource: q.resource,
        expiresAt: Date.now() + TTL.consent,
        attempts: 0,
      };
      await saveSession(req);
      htmlHeaders(res, formTarget);
      return res.send(
        consentPage({
          requestId,
          clientName: client.name,
          redirectHost: isLoopbackRedirect(redirectUri) ? `${new URL(redirectUri).host} (tu computador)` : new URL(redirectUri).host,
          loopback: isLoopbackRedirect(redirectUri),
          email: user.email,
          scopes,
        }),
      );
    } catch (err: any) {
      console.error("[mcp-oauth] authorize:", err?.message);
      htmlHeaders(res);
      return res.status(500).send(errorPage("Error interno."));
    }
  });

  router.post(OAUTH_PATHS.authorize, limiter(15 * 60 * 1000, 30), form, sessionMiddleware, async (req, res) => {
    try {
      // CSRF: el formulario sólo se puede enviar desde esta misma página.
      // La defensa principal es request_id (aleatorio y atado a la sesión);
      // esto es una segunda capa. Sec-Fetch-Site lo pone el navegador y una
      // página no lo puede falsificar; Origin se mira cuando es un origen real.
      const fetchSite = req.header("sec-fetch-site");
      const origin = req.header("origin");
      const sameSite = fetchSite === "same-origin";
      const crossByFetch = fetchSite !== undefined && fetchSite !== "same-origin" && fetchSite !== "none";
      const crossByOrigin = !sameSite && origin !== undefined && origin !== "null" && origin !== ISSUER_ORIGIN;
      if (crossByFetch || crossByOrigin) {
        await writeAudit({
          tool: "oauth_consent_origen_rechazado",
          scope: "auth",
          userId: req.session?.userId ?? null,
          ip: clientIp(req),
          args: { origin: origin ?? null, secFetchSite: fetchSite ?? null, esperado: ISSUER_ORIGIN },
          ok: false,
        });
        htmlHeaders(res);
        return res.status(403).send(errorPage("Origen no permitido."));
      }
      const requestId = String(req.body?.request_id || "");
      const store = req.session?.userId ? pendingStore(req) : {};
      const pending = store[requestId];
      if (!pending) {
        htmlHeaders(res);
        return res.status(400).send(errorPage("La solicitud venció o no es válida."));
      }
      const client = await findClient(pending.clientId);
      const user = req.session.userId ? await loadStaff(req.session.userId) : null;
      if (!client || !user || (req.session as any).twoFactorPending) {
        delete store[requestId];
        await saveSession(req);
        htmlHeaders(res);
        return res.status(400).send(errorPage("La sesión cambió. Vuelve a conectar desde Claude."));
      }
      const audit = { scope: "auth", userId: user.id, clientId: client.id, ip: clientIp(req) };

      if (req.body?.decision !== "approve") {
        delete store[requestId];
        await saveSession(req);
        await writeAudit({ ...audit, tool: "oauth_consent_rechazado", ok: true });
        return redirectWith(res, pending.redirectUri, { error: "access_denied", state: pending.state });
      }

      // Se vuelve a calcular: el rol o el 2FA pudieron cambiar desde la pantalla.
      const scopes = grantScope(pending.scope, maxScopeFor(user));
      const check = user.twoFactorSecret
        ? verifyTotp(user.twoFactorSecret, String(req.body?.code || ""), { lastUsedStep: user.twoFactorLastUsedStep })
        : ({ ok: false } as const);
      if (!scopes.length || !check.ok) {
        pending.attempts += 1;
        await writeAudit({ ...audit, tool: "oauth_consent_2fa_fallido", ok: false });
        if (pending.attempts >= MAX_CONSENT_ATTEMPTS) {
          delete store[requestId];
          await saveSession(req);
          htmlHeaders(res);
          return res.status(429).send(errorPage("Demasiados códigos incorrectos. Vuelve a conectar desde Claude."));
        }
        await saveSession(req);
        htmlHeaders(res, new URL(pending.redirectUri).origin);
        return res.status(400).send(
          consentPage({
            requestId,
            clientName: client.name,
            redirectHost: new URL(pending.redirectUri).host,
            loopback: isLoopbackRedirect(pending.redirectUri),
            email: user.email,
            scopes: pending.scope.split(" "),
            error: "Código incorrecto o ya usado. Espera el siguiente e intenta de nuevo.",
          }),
        );
      }

      // El código TOTP no se puede volver a usar.
      await prisma.user.update({ where: { id: user.id }, data: { twoFactorLastUsedStep: check.step } });
      delete store[requestId];
      await saveSession(req);

      const code = await createAuthCode({
        clientId: client.id,
        userId: user.id,
        redirectUri: pending.redirectUri,
        codeChallenge: pending.codeChallenge,
        scope: scopes.join(" "),
        resource: pending.resource,
      });
      await writeAudit({ ...audit, tool: "oauth_consent_aprobado", args: { scope: scopes.join(" "), cliente: client.name }, ok: true });
      // Aviso a todos los admins: si no fueron ellos, lo ven al tiro.
      emitAdminEvent({ type: "mcp_authorized", user: `${user.email} → ${client.name}` }).catch(() => {});
      return redirectWith(res, pending.redirectUri, { code, state: pending.state });
    } catch (err: any) {
      console.error("[mcp-oauth] consent:", err?.message);
      htmlHeaders(res);
      return res.status(500).send(errorPage("Error interno."));
    }
  });

  // ── Token ────────────────────────────────────────────────────────────────
  router.post(OAUTH_PATHS.token, limiter(60 * 1000, 30), form, json, async (req, res) => {
    const ip = clientIp(req);
    try {
      const body = req.body || {};
      let clientIdParam = body.client_id;
      const basic = req.header("authorization") || "";
      if (!clientIdParam && basic.toLowerCase().startsWith("basic ")) {
        const decoded = Buffer.from(basic.slice(6), "base64").toString("utf8");
        clientIdParam = decodeURIComponent(decoded.slice(0, decoded.indexOf(":")));
      }
      const client = await findClient(clientIdParam);
      if (!client || !clientAuthenticated(req, client)) return oauthError(res, 401, "invalid_client");

      if (body.grant_type === "authorization_code") {
        const result = await consumeAuthCode(String(body.code || ""));
        if (!result.ok) {
          // Un código reusado es señal de robo: se revoca lo emitido con él.
          if (result.reason === "reused" && result.row) {
            const families = await prisma.mcpOAuthToken.findMany({
              where: { clientId: result.row.clientId, userId: result.row.userId, createdAt: { gte: result.row.createdAt } },
              select: { familyId: true },
            });
            for (const f of new Set(families.map((x) => x.familyId))) await revokeFamily(f, "codigo_reusado");
          }
          await writeAudit({ tool: "oauth_token_codigo_invalido", scope: "auth", clientId: client.id, ip, args: { motivo: result.reason }, ok: false });
          return oauthError(res, 400, "invalid_grant");
        }
        const row = result.row;
        if (row.clientId !== client.id || row.redirectUri !== String(body.redirect_uri || "")) {
          return oauthError(res, 400, "invalid_grant");
        }
        if (!verifyPkce(String(body.code_verifier || ""), row.codeChallenge)) {
          await writeAudit({ tool: "oauth_token_pkce_fallido", scope: "auth", userId: row.userId, clientId: client.id, ip, ok: false });
          return oauthError(res, 400, "invalid_grant", "PKCE inválido.");
        }
        const user = await loadStaff(row.userId);
        const scopes = user ? grantScope(row.scope, maxScopeFor(user)) : [];
        if (!scopes.length) return oauthError(res, 400, "invalid_grant");
        const tokens = await issueTokens({ clientId: client.id, userId: row.userId, scope: scopes.join(" "), ip: ip ?? undefined });
        await prisma.mcpOAuthClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        await writeAudit({ tool: "oauth_token_emitido", scope: "auth", userId: row.userId, clientId: client.id, ip, args: { scope: tokens.scope }, ok: true });
        noStore(res);
        return res.json(tokens);
      }

      if (body.grant_type === "refresh_token") {
        const refresh = String(body.refresh_token || "");
        const row = refresh.startsWith("uzmcp_rt_")
          ? await prisma.mcpOAuthToken.findUnique({ where: { refreshHash: sha256(refresh) } })
          : null;
        if (!row || row.clientId !== client.id) return oauthError(res, 400, "invalid_grant");
        if (row.rotatedAt || row.revokedAt) {
          // Refresh ya usado: alguien más tiene una copia. Se corta toda la familia.
          if (row.rotatedAt && !row.revokedAt) await revokeFamily(row.familyId, "refresh_reusado");
          await writeAudit({ tool: "oauth_refresh_reusado", scope: "auth", userId: row.userId, clientId: client.id, ip, ok: false });
          return oauthError(res, 400, "invalid_grant");
        }
        const now = new Date();
        if (row.refreshExpiresAt <= now || row.familyExpiresAt <= now) return oauthError(res, 400, "invalid_grant");
        const user = await loadStaff(row.userId);
        const scopes = user ? grantScope(row.scope, maxScopeFor(user)) : [];
        if (!scopes.length) {
          await revokeFamily(row.familyId, "cuenta_sin_permiso");
          return oauthError(res, 400, "invalid_grant");
        }
        const rotated = await prisma.mcpOAuthToken.updateMany({
          where: { id: row.id, rotatedAt: null, revokedAt: null },
          data: { rotatedAt: now },
        });
        if (rotated.count !== 1) return oauthError(res, 400, "invalid_grant");
        const tokens = await issueTokens({
          clientId: client.id,
          userId: row.userId,
          scope: scopes.join(" "),
          familyId: row.familyId,
          familyExpiresAt: row.familyExpiresAt,
          ip: ip ?? undefined,
        });
        noStore(res);
        return res.json(tokens);
      }

      return oauthError(res, 400, "unsupported_grant_type");
    } catch (err: any) {
      console.error("[mcp-oauth] token:", err?.message);
      return oauthError(res, 500, "server_error");
    }
  });

  // ── Revocación (RFC 7009) ────────────────────────────────────────────────
  router.post(OAUTH_PATHS.revoke, limiter(60 * 1000, 30), form, json, async (req, res) => {
    try {
      const token = String(req.body?.token || "");
      const hash = sha256(token);
      const row = await prisma.mcpOAuthToken.findFirst({
        where: { OR: [{ accessHash: hash }, { refreshHash: hash }] },
        select: { familyId: true, userId: true, clientId: true },
      });
      if (row) {
        await revokeFamily(row.familyId, "revocado_por_cliente");
        await writeAudit({ tool: "oauth_revocado", scope: "auth", userId: row.userId, clientId: row.clientId, ip: clientIp(req), ok: true });
      }
      // Siempre 200 (RFC 7009): no se confirma si el token existía.
      noStore(res);
      return res.status(200).json({});
    } catch {
      return oauthError(res, 500, "server_error");
    }
  });

  return router;
}
