import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { config } from "../config";
import { isBusinessPlanActive } from "../lib/subscriptions";
import { getCachedUser, setCachedUser, type CachedUser } from "./userCache";

// Re-export for backward compat
export { invalidateUserCache } from "./userCache";

/**
 * Rutas que deben ser PUBLICAS (sin sesión).
 * OJO: dejamos /uploads y /webhooks abiertos también.
 *
 * Importante: como usamos `app.use(requireAuth)` globalmente, cualquier endpoint
 * que quieras público DEBE quedar aquí.
 */
const PUBLIC_PREFIXES = [
  "/health",
  "/ready",
  "/version",
  "/uploads",
  "/auth",              // login/register/me (me puede dar 401, ok)
  "/categories",        // ✅ HOME necesita esto sin sesión
  "/professionals",     // ✅ directorio público (solo GET)
  "/motels",            // ✅ hospedaje público
  "/profiles/discover", // ✅ HOME discovery sections (guests need this)
  "/profiles",          // ✅ perfil público por username/slug
  "/stories",           // ✅ stories visibles para invitados en el home
  "/banners",           // ✅ banners públicos en el home
  "/popup-promotions",  // ✅ popup promociones públicas home
  "/hot",               // ✅ trending content (Hot section)
  "/forum",             // ✅ forum public read (categories, threads, recent)
  "/webhooks/flow",     // Flow subscription webhooks
  "/directory",         // ✅ búsqueda pública de directorio (escorts, moteles, etc.)
  "/shop/sexshops",     // ✅ listado público de sex shops y sus productos
  "/videocall/config",  // ✅ config pública de videollamada por profesional
  "/wallet/config",     // ✅ config pública de plataforma (rates)
  "/wallet/packages",   // ✅ paquetes de tokens públicos
  "/live/active",       // ✅ listado público de streams activos
  "/live",              // ✅ detalle público de stream
  "/stats/platform",    // ✅ contadores públicos para hero del home
  "/privacy",           // ✅ solicitudes públicas de eliminación de cuenta/datos
  "/billing/status",    // ✅ verificación pública de pago Flow por ref (retorno pasarela)
  "/analytics",          // ✅ tracking de pageviews y acciones (funciona sin sesión)
  "/umate/plans",       // ✅ U-Mate plans (public)
  "/umate/feed",        // ✅ U-Mate feed (public, enriched when logged in)
  "/umate/creators",    // ✅ U-Mate creator explore (public)
  "/umate/profile",     // ✅ U-Mate creator profile (public)
  "/umate/trending",    // ✅ U-Mate trending posts (public)
  "/umate/suggested",   // ✅ U-Mate suggested creators (public)
  "/umate/posts",       // ✅ U-Mate post comments (public GET)
  "/umate/media",       // ✅ U-Mate signed premium media (HMAC token is the auth)
  "/market/config",     // ✅ reglas y tarifas públicas del marketplace
  "/market/products",   // ✅ catálogo público del marketplace
  "/market/sellers",    // ✅ vitrinas públicas de las vendedoras
  "/market/media",      // ✅ contenido comprado (la firma HMAC es la autorización)
  "/notifications/email/unsubscribe", // ✅ baja desde el enlace del correo (el HMAC es la autorización)
  "/face-verification", // ✅ enlace de verificación facial (el token del enlace es la autorización)
];

/**
 * Routes that require active subscription for business profiles.
 * These routes will be blocked if subscription has expired.
 */
const SUBSCRIPTION_PROTECTED_PREFIXES = [
  "/services",
  "/shop",
  "/motel",
  "/messages",
  "/feed",
  "/profile"
];

function isPublicPath(pathname: string) {
  return PUBLIC_PREFIXES.some((p) =>
    pathname === p ||
    pathname.startsWith(p + "/")
  );
}

function isSubscriptionProtected(pathname: string) {
  return SUBSCRIPTION_PROTECTED_PREFIXES.some((p) =>
    pathname.startsWith(p)
  );
}

/**
 * Middleware de autenticación por cookie de sesión (uzeed_session).
 * Si no hay sesión → 401 UNAUTHENTICATED.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // ✅ Lectura pública SOLO para listados/Mapa (no /services/active ni requests privadas)
    if (req.method === "GET") {
      const p = req.path;
      const isPublicServicesList = p === "/services" || p === "/services/global" || /^\/services\/[^/]+\/items$/.test(p);
      const isPublicMap = p === "/map";
      if (isPublicServicesList || isPublicMap) return next();
    }

    // ✅ Si es ruta pública, no exigimos sesión
    if (isPublicPath(req.path)) {
      const optionalUserId = (req.session as any)?.userId;
      if (optionalUserId) {
        const cached = getCachedUser(optionalUserId);
        const optUser = cached || await prisma.user.findUnique({
          where: { id: optionalUserId },
          select: { id: true, email: true, role: true, profileType: true, membershipExpiresAt: true, shopTrialEndsAt: true, createdAt: true }
        });
        if (optUser) {
          if (!cached) setCachedUser(optionalUserId, optUser as CachedUser["data"]);
          (req as any).user = optUser;
        }
      }
      return next();
    }

    const sessionUserId = (req.session as any)?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const cached = getCachedUser(sessionUserId);
    const user = cached || await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        id: true,
        email: true,
        role: true,
        profileType: true,
        membershipExpiresAt: true,
        shopTrialEndsAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    if (!cached) setCachedUser(sessionUserId, user as CachedUser["data"]);

    // Subscription check temporarily disabled — allow all users through
    // TODO: Re-enable subscription enforcement when payment flow is ready
    // if (isSubscriptionProtected(req.path) && !isBusinessPlanActive(user)) {
    //   if (req.path.startsWith("/billing") || req.path === "/auth/me") {
    //     (req as any).user = user;
    //     return next();
    //   }
    //   return res.status(403).json({
    //     error: "SUBSCRIPTION_EXPIRED",
    //     message: "Tu periodo de prueba ha expirado. Por favor, actualiza tu suscripción para continuar usando la app.",
    //     requiresPayment: true
    //   });
    // }

    (req as any).user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Lo único que una cuenta de equipo (MODERATOR) NO puede tocar.
 *
 * El modelo se dio vuelta a propósito: antes era una lista blanca de lecturas
 * y el equipo no podía resolver nada, así que cada solicitud terminaba en el
 * dueño. Ahora entra a todo el panel — aprueba verificaciones, cambios de
 * nombre y de número, depósitos, retiros, moderación, banners, precios — y lo
 * que queda fuera es esta lista corta, que son las jugadas sin vuelta atrás o
 * las que romperían el sentido de tener un rol reducido:
 *
 *  - /admin/quick-professionals: pedido explícito, es alta de perfiles falsos.
 *  - /admin/team: crear compañeros o ascenderse a sí mismo.
 *  - /admin/exports: baja la base completa en CSV, con teléfonos.
 *  - /plans: los planes de cobro de Khipu (dinero de verdad, no una solicitud).
 *
 * Además de esta lista, borrar perfiles queda fuera (ver más abajo) y todas
 * las acciones destructivas que ya pasan por `requireFresh2FA` siguen siendo
 * exclusivas del administrador: ese guard exige rol ADMIN.
 */
const MODERATOR_BLOCKED_PREFIXES = [
  "/admin/quick-professionals",
  "/admin/team",
  "/admin/exports",
  "/plans",
];

/**
 * ¿Quien hace esta petición es equipo y nada más? Se usa dentro de los
 * handlers que dejan pasar al equipo pero le recortan qué campos puede tocar.
 * Depende de que `requireAdmin` (o `requireAuth`) ya haya cargado `req.user`.
 */
export function isTeamOnlyRequest(req: Request): boolean {
  const user = (req as any).user as { email?: string; role?: string } | undefined;
  if (!user) return false;
  const role = (user.role || "").toUpperCase();
  if (role !== "MODERATOR") return false;
  return user.email !== config.adminEmail;
}

/** Editar identidad (nombre, teléfono) y rol tampoco: ver `moderatorBlockedProfileFields`. */
const MODERATOR_BLOCKED_PROFILE_FIELDS = ["displayName", "phone", "role"] as const;

/**
 * Campos de PUT /admin/profiles/:id vedados al equipo. Las tarifas sí se
 * editan: el pedido fue justamente ese, poder corregir precios sin poder
 * cambiarle el nombre ni el número a nadie (eso pasa por el dueño, porque es
 * lo que identifica y contacta al perfil).
 */
export function moderatorBlockedProfileFields(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  return MODERATOR_BLOCKED_PROFILE_FIELDS.filter(
    (field) => (body as Record<string, unknown>)[field] !== undefined,
  );
}

function pathMatches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Qué puede pedir una cuenta de equipo. Todo el panel menos la lista negra y
 * menos borrar perfiles.
 */
export function isModeratorAllowedRequest(req: Request): boolean {
  // originalUrl y no req.path: dentro de un router montado, req.path viene
  // recortado y perdería el prefijo /admin que estamos comparando.
  const path = (req.originalUrl || req.url || "").split("?")[0];

  if (MODERATOR_BLOCKED_PREFIXES.some((prefix) => pathMatches(path, prefix))) {
    return false;
  }

  // Eliminar perfiles es la única baja que se nombró explícitamente. Se corta
  // por método para que no dependa de qué endpoint nuevo cuelgue del prefijo.
  if (req.method.toUpperCase() === "DELETE" && pathMatches(path, "/admin/profiles")) {
    return false;
  }

  return true;
}

/**
 * Admin guard: requiere sesión + que el usuario sea ADMIN (por email o por role).
 *
 * Las cuentas MODERATOR (equipo) entran a todo el panel salvo lo que corta
 * `isModeratorAllowedRequest`. Para lo demás reciben 403 como cualquier
 * usuario.
 *
 * Además bloquea cualquier endpoint /admin/* cuando el admin tiene 2FA habilitado
 * pero todavía no resolvió el challenge en esta sesión (`twoFactorPending`).
 * Las rutas para resolver el challenge están en /auth/2fa/* y no pasan por aquí.
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Primero valida sesión / carga (req as any).user
  await requireAuth(req, res, async (err?: any) => {
    if (err) return next(err);

    const user = (req as any).user as { email?: string; role?: string } | undefined;
    if (!user?.email) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const role = (user.role || "").toUpperCase();
    const isAdminByEmail = user.email === config.adminEmail;
    const isAdminByRole = role === "ADMIN";
    const isTeamMember = role === "MODERATOR";

    if (!isAdminByEmail && !isAdminByRole && !isTeamMember) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    // Una cuenta de equipo que además es administradora por correo o por rol
    // no es equipo: manda el permiso más alto.
    const isTeamOnly = isTeamMember && !isAdminByEmail && !isAdminByRole;
    if (isTeamOnly && !isModeratorAllowedRequest(req)) {
      return res.status(403).json({
        error: "FORBIDDEN_FOR_TEAM",
        message: "Esta acción es sólo para el administrador.",
      });
    }

    // El challenge de doble factor se exige a todos por igual: si la cuenta lo
    // tiene activado y no lo resolvió en esta sesión, no entra al panel.
    if ((req.session as any)?.twoFactorPending) {
      return res.status(401).json({
        error: "TWO_FACTOR_PENDING",
        message: "Verifica tu código de doble factor para continuar.",
      });
    }

    return next();
  });
}
