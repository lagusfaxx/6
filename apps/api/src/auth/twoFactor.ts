import { Router, type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import { invalidateUserCache } from "./userCache";
import {
  buildOtpauthUrl,
  generateTotpSecret,
  verifyTotp,
} from "./totp";

export const twoFactorRouter = Router();

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Espera unos minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

function isAdminRoleOrEmail(user: { email?: string | null; role?: string | null }): boolean {
  const byRole = (user.role || "").toUpperCase() === "ADMIN";
  const byEmail = user.email && user.email === config.adminEmail;
  return Boolean(byRole || byEmail);
}

async function requireSession(req: Request, res: Response): Promise<{ id: string; email: string; role: string; twoFactorSecret: string | null; twoFactorEnabled: boolean; twoFactorLastUsedStep: bigint | null } | null> {
  if (!req.session.userId) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return null;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: {
      id: true,
      email: true,
      role: true,
      twoFactorSecret: true,
      twoFactorEnabled: true,
      twoFactorLastUsedStep: true,
    },
  });
  if (!user) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return null;
  }
  return user;
}

twoFactorRouter.get(
  "/2fa/status",
  asyncHandler(async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;
    const adminRequired = isAdminRoleOrEmail(user);
    return res.json({
      enabled: user.twoFactorEnabled,
      required: adminRequired,
      pending: Boolean((req.session as any).twoFactorPending),
    });
  }),
);

twoFactorRouter.post(
  "/2fa/setup",
  asyncHandler(async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    if (!isAdminRoleOrEmail(user)) {
      return res.status(403).json({ error: "FORBIDDEN", message: "Solo administradores pueden configurar 2FA." });
    }
    if (user.twoFactorEnabled) {
      return res.status(409).json({ error: "ALREADY_ENABLED", message: "El doble factor ya está activado." });
    }

    const secret = generateTotpSecret();
    (req.session as any).pendingTwoFactorSecret = secret;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    const otpauthUrl = buildOtpauthUrl(secret, user.email, "UZEED Admin");
    return res.json({ secret, otpauthUrl });
  }),
);

twoFactorRouter.post(
  "/2fa/enable",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    if (!isAdminRoleOrEmail(user)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    if (user.twoFactorEnabled) {
      return res.status(409).json({ error: "ALREADY_ENABLED" });
    }

    const pending = (req.session as any).pendingTwoFactorSecret;
    if (!pending) {
      return res.status(400).json({ error: "NO_PENDING_SETUP", message: "Inicia la configuración antes de confirmar." });
    }
    const code = String(req.body?.code || "");
    const result = verifyTotp(pending, code);
    if (!result.ok) {
      return res.status(400).json({ error: "INVALID_CODE", message: "Código inválido o expirado." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: pending,
        twoFactorEnabled: true,
        twoFactorEnrolledAt: new Date(),
        twoFactorLastUsedStep: result.step,
      },
    });
    invalidateUserCache(user.id);

    (req.session as any).pendingTwoFactorSecret = undefined;
    (req.session as any).twoFactorPending = false;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return res.json({ ok: true, enabled: true });
  }),
);

/**
 * Login challenge: an admin with 2FA enabled lands here right after password
 * verification. The session already carries `userId`, but `twoFactorPending`
 * blocks admin actions until a valid code is supplied.
 */
twoFactorRouter.post(
  "/2fa/verify",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: "NOT_ENROLLED", message: "Este usuario no tiene 2FA configurado." });
    }
    const code = String(req.body?.code || "");
    const result = verifyTotp(user.twoFactorSecret, code, {
      lastUsedStep: user.twoFactorLastUsedStep,
    });
    if (!result.ok) {
      return res.status(400).json({ error: "INVALID_CODE", message: "Código inválido o ya utilizado." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorLastUsedStep: result.step },
    });

    (req.session as any).twoFactorPending = false;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return res.json({ ok: true });
  }),
);

/**
 * Allows an admin to disable 2FA (e.g. to re-enroll a new device). They must
 * still provide a valid current code, so a stolen session alone cannot strip
 * the protection.
 */
twoFactorRouter.post(
  "/2fa/disable",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: "NOT_ENROLLED" });
    }
    if (!isAdminRoleOrEmail(user)) {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const code = String(req.body?.code || "");
    const result = verifyTotp(user.twoFactorSecret, code, {
      lastUsedStep: user.twoFactorLastUsedStep,
    });
    if (!result.ok) {
      return res.status(400).json({ error: "INVALID_CODE" });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        twoFactorEnrolledAt: null,
        twoFactorLastUsedStep: null,
      },
    });
    invalidateUserCache(user.id);
    return res.json({ ok: true });
  }),
);

/**
 * Middleware that gates destructive admin endpoints behind a *fresh* TOTP
 * code. The client must pass the current 6-digit code on every call via the
 * `x-2fa-code` header or a `mfaCode` field in the JSON body.
 *
 * If the admin user has not yet enrolled in 2FA, the request is rejected with
 * a hint pointing at the setup flow — we never silently bypass.
 */
export async function requireFresh2FA(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        twoFactorSecret: true,
        twoFactorEnabled: true,
        twoFactorLastUsedStep: true,
      },
    });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    if (!isAdminRoleOrEmail(user)) return res.status(403).json({ error: "FORBIDDEN" });

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(412).json({
        error: "TWO_FACTOR_REQUIRED",
        message: "Configura el doble factor antes de ejecutar acciones críticas.",
      });
    }
    if ((req.session as any).twoFactorPending) {
      return res.status(401).json({
        error: "TWO_FACTOR_PENDING",
        message: "Verifica tu código de doble factor para continuar.",
      });
    }
    const headerCode = req.header("x-2fa-code");
    const bodyCode = typeof req.body?.mfaCode === "string" ? req.body.mfaCode : undefined;
    const code = headerCode || bodyCode || "";
    const result = verifyTotp(user.twoFactorSecret, code, {
      lastUsedStep: user.twoFactorLastUsedStep,
    });
    if (!result.ok) {
      return res.status(401).json({
        error: "INVALID_MFA_CODE",
        message: "Código de Google Authenticator inválido o reutilizado.",
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorLastUsedStep: result.step },
    });
    return next();
  } catch (err) {
    return next(err);
  }
}
