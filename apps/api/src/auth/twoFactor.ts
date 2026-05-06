import { Router, type Request, type Response, type NextFunction } from "express";
import argon2 from "argon2";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { invalidateUserCache } from "../auth/userCache";
import { writeAdminAuditLog } from "../lib/adminAudit";
import {
  TOTP_CONFIG,
  buildOtpauthUri,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  verifyTotp,
} from "../lib/totp";

export const twoFactorRouter = Router();

// ── Rate limits ─────────────────────────────────────────────────────────
//
// Brute-forcing 6-digit TOTP codes is the only realistic attack against a
// stolen-but-locked session, so /verify and /login-verify are heavily limited
// per IP. Setup/disable are protected by sensitive-action limits too.

const totpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Intenta en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

const totpManageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Step-up window ──────────────────────────────────────────────────────
//
// After /auth/2fa/verify (a fresh, on-demand TOTP) the session is
// considered "step-up authenticated" for STEP_UP_WINDOW_MS. Sensitive
// admin actions (delete profile, role change, approve withdrawal) require
// a step-up no older than this window.
export const STEP_UP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ── Pending setup secrets ───────────────────────────────────────────────
//
// We don't write the new secret to the DB until the user proves they
// stored it (by typing a code from the authenticator app). Until then it
// lives in this in-memory map keyed by userId. Single-process: this is
// acceptable because /2fa/setup → /2fa/enable is a single user action that
// happens on the same backend instance within seconds.
interface PendingSetup {
  encrypted: string;
  base32: string;
  expiresAt: number;
}
const pendingSetups = new Map<string, PendingSetup>();
const SETUP_TTL_MS = 10 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingSetups) if (v.expiresAt < now) pendingSetups.delete(k);
}, 60 * 1000).unref?.();

// ── Helpers ─────────────────────────────────────────────────────────────

function requireSession(req: Request, res: Response): string | null {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return null;
  }
  return userId;
}

async function consumeBackupCode(
  hashList: string | null,
  candidate: string,
): Promise<{ ok: boolean; remainingHashList: string }> {
  if (!hashList) return { ok: false, remainingHashList: "" };
  const lines = hashList.split("\n").filter(Boolean);
  // Normalize candidate (strip spaces/dashes, lowercase) so users can type
  // "abcde fghij" or "ABCDE-FGHIJ" interchangeably.
  const normalized = String(candidate || "").trim().toLowerCase().replace(/\s+/g, "");
  // We must check every entry to remain timing-safe (don't short-circuit on
  // first match — this also avoids a side-channel revealing position).
  let matchedIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    try {
      // argon2.verify throws on malformed hash; catch per-entry so a corrupt
      // line doesn't lock the whole list.
      // We accept either the dashed or undashed form — try both.
      const hyphen = normalized.length === 10
        ? `${normalized.slice(0, 5)}-${normalized.slice(5)}`
        : normalized;
      if (await argon2.verify(lines[i], hyphen)) matchedIndex = i;
      else if (await argon2.verify(lines[i], normalized)) matchedIndex = i;
    } catch {
      // ignore malformed line
    }
  }
  if (matchedIndex < 0) return { ok: false, remainingHashList: hashList };
  const next = lines.filter((_, i) => i !== matchedIndex).join("\n");
  return { ok: true, remainingHashList: next };
}

function captureRequestFingerprint(req: Request): { ip: string | null; userAgent: string | null } {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
  const userAgent = (req.headers["user-agent"] as string) || null;
  return { ip, userAgent };
}

// ── Public status ───────────────────────────────────────────────────────

twoFactorRouter.get(
  "/2fa/status",
  asyncHandler(async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        totpEnabled: true,
        totpEnabledAt: true,
        totpBackupCodesHash: true,
        role: true,
      },
    });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const session = req.session as any;
    return res.json({
      enabled: !!user.totpEnabled,
      enabledAt: user.totpEnabledAt?.toISOString() || null,
      backupCodesRemaining: user.totpBackupCodesHash
        ? user.totpBackupCodesHash.split("\n").filter(Boolean).length
        : 0,
      pendingLoginVerification: !!session.pendingTotp,
      stepUpVerifiedAt: session.totpVerifiedAt
        ? new Date(session.totpVerifiedAt).toISOString()
        : null,
      stepUpFresh: isStepUpFresh(req),
      // Admins should be strongly nudged into 2FA — surface this so the UI
      // can show a banner. We don't *force* it server-side yet to avoid
      // locking out the seeded admin on first deploy; once an admin opts in
      // it cannot be disabled without TOTP itself.
      recommendedForRole: (user.role || "USER").toUpperCase() === "ADMIN",
    });
  }),
);

// ── Setup: generate fresh secret + otpauth URI ──────────────────────────

twoFactorRouter.post(
  "/2fa/setup",
  totpManageLimiter,
  asyncHandler(async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, totpEnabled: true },
    });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    if (user.totpEnabled) {
      return res.status(409).json({
        error: "TOTP_ALREADY_ENABLED",
        message: "El segundo factor ya está activo. Desactívalo antes de generar uno nuevo.",
      });
    }
    const { base32 } = generateSecret();
    const encrypted = encryptSecret(base32);
    pendingSetups.set(userId, {
      encrypted,
      base32,
      expiresAt: Date.now() + SETUP_TTL_MS,
    });
    const otpauthUri = buildOtpauthUri({
      secretBase32: base32,
      accountName: user.email,
      issuer: TOTP_CONFIG.ISSUER,
    });
    return res.json({
      secret: base32, // shown once so the user can paste it manually
      otpauthUri, // frontend renders this as a QR
      issuer: TOTP_CONFIG.ISSUER,
      digits: TOTP_CONFIG.DIGITS,
      period: TOTP_CONFIG.STEP_SECONDS,
    });
  }),
);

// ── Enable: confirm by entering the first valid code ────────────────────

twoFactorRouter.post(
  "/2fa/enable",
  totpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;
    const { code } = req.body ?? {};
    if (!code) return res.status(400).json({ error: "CODE_REQUIRED" });
    const pending = pendingSetups.get(userId);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingSetups.delete(userId);
      return res.status(400).json({
        error: "SETUP_EXPIRED",
        message: "La configuración expiró. Vuelve a iniciar el alta del segundo factor.",
      });
    }
    const secretBuf = Buffer.from(pending.base32 ? base32ToBuf(pending.base32) : []);
    const ok = verifyTotp(secretBuf, String(code));
    if (!ok) {
      return res.status(400).json({
        error: "CODE_INVALID",
        message: "El código ingresado no es válido. Verifica que tu reloj esté sincronizado.",
      });
    }

    // Generate backup codes only after the user proves they have the secret.
    const { plain, hashList } = await generateBackupCodes(8, (s) =>
      argon2.hash(s, { type: argon2.argon2id }),
    );

    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: pending.encrypted,
        totpEnabled: true,
        totpEnabledAt: new Date(),
        totpBackupCodesHash: hashList,
        lastTotpVerifiedAt: new Date(),
      },
    });
    pendingSetups.delete(userId);
    invalidateUserCache(userId);

    const session = req.session as any;
    session.totpVerifiedAt = Date.now();
    session.pendingTotp = false;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    await writeAdminAuditLog({
      adminId: userId,
      action: "totp_enabled",
      targetType: "user",
      targetId: userId,
      ...captureRequestFingerprint(req),
    }).catch(() => {});

    return res.json({
      ok: true,
      backupCodes: plain, // shown ONCE; UI must force the user to save them
    });
  }),
);

function base32ToBuf(b32: string): Buffer {
  // tiny inline import to avoid a cycle
  const { base32Decode } = require("../lib/totp");
  return base32Decode(b32);
}

// ── Step-up: re-verify TOTP for a sensitive action ──────────────────────

twoFactorRouter.post(
  "/2fa/verify",
  totpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;
    const { code, backupCode } = req.body ?? {};
    if (!code && !backupCode) return res.status(400).json({ error: "CODE_REQUIRED" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        totpEnabled: true,
        totpSecret: true,
        totpBackupCodesHash: true,
      },
    });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    if (!user.totpEnabled || !user.totpSecret) {
      return res.status(409).json({ error: "TOTP_NOT_ENABLED" });
    }

    let verified = false;
    let usedBackup = false;

    if (backupCode) {
      const result = await consumeBackupCode(user.totpBackupCodesHash, backupCode);
      if (result.ok) {
        verified = true;
        usedBackup = true;
        await prisma.user.update({
          where: { id: userId },
          data: { totpBackupCodesHash: result.remainingHashList },
        });
      }
    } else {
      try {
        const decrypted = decryptSecret(user.totpSecret);
        verified = verifyTotp(base32ToBuf(decrypted), String(code));
      } catch (err) {
        console.error("[2fa] decrypt failed for user", userId, err);
        return res.status(500).json({ error: "TOTP_DECRYPT_FAILED" });
      }
    }

    if (!verified) {
      return res.status(400).json({ error: "CODE_INVALID", message: "Código incorrecto." });
    }

    const now = Date.now();
    await prisma.user.update({
      where: { id: userId },
      data: { lastTotpVerifiedAt: new Date(now) },
    });
    invalidateUserCache(userId);

    const session = req.session as any;
    session.pendingTotp = false;
    session.totpVerifiedAt = now;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );

    await writeAdminAuditLog({
      adminId: userId,
      action: usedBackup ? "totp_backup_used" : "totp_verified",
      targetType: "user",
      targetId: userId,
      ...captureRequestFingerprint(req),
    }).catch(() => {});

    return res.json({
      ok: true,
      verifiedAt: new Date(now).toISOString(),
      stepUpExpiresAt: new Date(now + STEP_UP_WINDOW_MS).toISOString(),
      usedBackup,
    });
  }),
);

// ── Disable: requires fresh TOTP + current password ─────────────────────

twoFactorRouter.post(
  "/2fa/disable",
  totpManageLimiter,
  asyncHandler(async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;
    const { code, password } = req.body ?? {};
    if (!code || !password) {
      return res.status(400).json({ error: "MISSING_FIELDS", message: "Código y contraseña requeridos." });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        totpEnabled: true,
        totpSecret: true,
      },
    });
    if (!user) return res.status(401).json({ error: "UNAUTHENTICATED" });
    if (!user.totpEnabled || !user.totpSecret) {
      return res.status(409).json({ error: "TOTP_NOT_ENABLED" });
    }
    if (!user.passwordHash || !(await argon2.verify(user.passwordHash, String(password)))) {
      return res.status(401).json({ error: "INVALID_PASSWORD" });
    }
    const decrypted = decryptSecret(user.totpSecret);
    if (!verifyTotp(base32ToBuf(decrypted), String(code))) {
      return res.status(400).json({ error: "CODE_INVALID" });
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpEnabledAt: null,
        totpSecret: null,
        totpBackupCodesHash: null,
        lastTotpVerifiedAt: null,
      },
    });
    invalidateUserCache(userId);
    const session = req.session as any;
    session.totpVerifiedAt = undefined;
    session.pendingTotp = false;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
    await writeAdminAuditLog({
      adminId: userId,
      action: "totp_disabled",
      targetType: "user",
      targetId: userId,
      ...captureRequestFingerprint(req),
    }).catch(() => {});
    return res.json({ ok: true });
  }),
);

// ── Regenerate backup codes (requires fresh TOTP) ───────────────────────

twoFactorRouter.post(
  "/2fa/backup-codes/regenerate",
  totpManageLimiter,
  asyncHandler(async (req, res) => {
    const userId = requireSession(req, res);
    if (!userId) return;
    if (!isStepUpFresh(req)) {
      return res.status(403).json({
        error: "STEP_UP_REQUIRED",
        message: "Verifica tu segundo factor antes de regenerar códigos de respaldo.",
      });
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true },
    });
    if (!user?.totpEnabled) return res.status(409).json({ error: "TOTP_NOT_ENABLED" });

    const { plain, hashList } = await generateBackupCodes(8, (s) =>
      argon2.hash(s, { type: argon2.argon2id }),
    );
    await prisma.user.update({
      where: { id: userId },
      data: { totpBackupCodesHash: hashList },
    });
    return res.json({ ok: true, backupCodes: plain });
  }),
);

// ── Login flow: verify TOTP after username/password ─────────────────────
//
// /auth/login sets session.userId AND session.pendingTotp=true when 2FA is
// enabled, but DOES NOT yet count as authenticated for the rest of the API.
// The user must POST /auth/2fa/login-verify with a valid code to clear the
// pending flag.

twoFactorRouter.post(
  "/2fa/login-verify",
  totpVerifyLimiter,
  asyncHandler(async (req, res) => {
    const session = req.session as any;
    const userId = session.userId;
    if (!userId || !session.pendingTotp) {
      return res.status(400).json({ error: "NO_PENDING_TOTP" });
    }
    const { code, backupCode } = req.body ?? {};
    if (!code && !backupCode) return res.status(400).json({ error: "CODE_REQUIRED" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        totpEnabled: true,
        totpSecret: true,
        totpBackupCodesHash: true,
      },
    });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      // Defensive: if 2FA was disabled between login and verify, just clear.
      session.pendingTotp = false;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve())),
      );
      return res.json({ ok: true });
    }

    let verified = false;
    let usedBackup = false;
    if (backupCode) {
      const result = await consumeBackupCode(user.totpBackupCodesHash, backupCode);
      if (result.ok) {
        verified = true;
        usedBackup = true;
        await prisma.user.update({
          where: { id: userId },
          data: { totpBackupCodesHash: result.remainingHashList },
        });
      }
    } else {
      const decrypted = decryptSecret(user.totpSecret);
      verified = verifyTotp(base32ToBuf(decrypted), String(code));
    }
    if (!verified) {
      return res.status(400).json({ error: "CODE_INVALID", message: "Código incorrecto." });
    }

    const now = Date.now();
    await prisma.user.update({
      where: { id: userId },
      data: { lastTotpVerifiedAt: new Date(now) },
    });
    invalidateUserCache(userId);

    session.pendingTotp = false;
    session.totpVerifiedAt = now;
    await new Promise<void>((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve())),
    );
    return res.json({ ok: true, usedBackup });
  }),
);

// ── Step-up freshness helper exported for routes ────────────────────────

export function isStepUpFresh(req: Request): boolean {
  const session = req.session as any;
  if (!session?.totpVerifiedAt) return false;
  return Date.now() - Number(session.totpVerifiedAt) <= STEP_UP_WINDOW_MS;
}

/**
 * Express middleware: rejects the request if the user does not have a
 * recent TOTP step-up (or, if 2FA is not enabled, if their account is one
 * we require it on — admins). Mount AFTER requireAuth/requireAdmin.
 *
 * Behavior:
 *   - 2FA disabled and role !== ADMIN  → allow (preserves UX for normal users
 *     until they opt in). Add `requireRecentTotpStrict` for endpoints that
 *     must always require it.
 *   - 2FA disabled and role === ADMIN  → 403 TOTP_REQUIRED (admins must
 *     enable 2FA before performing destructive actions).
 *   - 2FA enabled and step-up stale    → 403 STEP_UP_REQUIRED.
 *   - 2FA enabled and step-up fresh    → next()
 */
export function requireRecentTotp(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as any).user as { role?: string; id?: string; totpEnabled?: boolean } | undefined;
  if (!user) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }
  const role = (user.role || "").toUpperCase();
  // Allow non-admins through if they haven't enabled 2FA yet — but if they
  // HAVE enabled it, always demand a fresh step-up for sensitive actions.
  if (!user.totpEnabled && role !== "ADMIN") {
    next();
    return;
  }
  if (!user.totpEnabled && role === "ADMIN") {
    res.status(403).json({
      error: "TOTP_REQUIRED",
      message:
        "Esta acción requiere autenticación de dos factores. Activa Google Authenticator en /cuenta/seguridad antes de continuar.",
    });
    return;
  }
  if (!isStepUpFresh(req)) {
    res.status(403).json({
      error: "STEP_UP_REQUIRED",
      message: "Vuelve a ingresar tu código de Google Authenticator para confirmar la acción.",
    });
    return;
  }
  next();
}

/**
 * Stricter variant for endpoints that should ALWAYS require a fresh TOTP
 * (e.g. self-service account deletion, key rotation). Forces the user to
 * have 2FA enabled regardless of role.
 */
export function requireRecentTotpStrict(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = (req as any).user as { role?: string; id?: string; totpEnabled?: boolean } | undefined;
  if (!user) {
    res.status(401).json({ error: "UNAUTHENTICATED" });
    return;
  }
  if (!user.totpEnabled) {
    res.status(403).json({
      error: "TOTP_REQUIRED",
      message: "Activa Google Authenticator en /cuenta/seguridad antes de continuar.",
    });
    return;
  }
  if (!isStepUpFresh(req)) {
    res.status(403).json({
      error: "STEP_UP_REQUIRED",
      message: "Vuelve a ingresar tu código de Google Authenticator para confirmar la acción.",
    });
    return;
  }
  next();
}
