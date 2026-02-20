import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { config } from "../config";
import { isBusinessPlanActive } from "../lib/subscriptions";

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
  "/cities",            // ✅ /cities/with_supply needed for public catalog
  "/banners",           // ✅ HOME banners (guests need this)
  "/webhooks/flow"      // Flow subscription webhooks
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
    pathname.startsWith(p + "/") ||
    pathname.startsWith(p)
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
    if (isPublicPath(req.path)) return next();

    const sessionUserId = (req.session as any)?.userId;
    if (!sessionUserId) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        id: true,
        email: true,
        profileType: true,
        membershipExpiresAt: true,
        shopTrialEndsAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    // Check subscription status for business profiles
    if (isSubscriptionProtected(req.path) && !isBusinessPlanActive(user)) {
      // Allow billing and subscription management routes even if expired
      if (req.path.startsWith("/billing") || req.path === "/auth/me") {
        (req as any).user = user;
        return next();
      }
      
      return res.status(403).json({ 
        error: "SUBSCRIPTION_EXPIRED", 
        message: "Tu periodo de prueba ha expirado. Por favor, actualiza tu suscripción para continuar usando la app.",
        requiresPayment: true
      });
    }

    (req as any).user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Admin guard: requiere sesión + que el usuario sea el ADMIN_EMAIL.
 * (No hay campo isAdmin en el schema actual; se usa adminEmail desde env.)
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Primero valida sesión / carga (req as any).user
  await requireAuth(req, res, async (err?: any) => {
    if (err) return next(err);

    const user = (req as any).user as { email?: string } | undefined;
    if (!user?.email) return res.status(401).json({ error: "UNAUTHENTICATED" });

    if (user.email !== config.adminEmail) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    return next();
  });
}

