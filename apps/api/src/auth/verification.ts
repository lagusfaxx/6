import { Router } from "express";
import argon2 from "argon2";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { config } from "../config";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { sendMail, smtpConfigured } from "../lib/mailer";
import { normalizePhoneForWhatsApp } from "../notifications/whatsapp";
import { phoneCodeChannels, sendCodeToPhone, type PhoneChannel } from "./phoneCode";

export const verificationRouter = Router();

// IP-based rate limit for code-sending endpoints (prevents email bombing)
const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5, // max 5 code-send requests per IP per window
  message: { error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Intenta en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

// IP-based rate limit for code verification (prevents brute-force across emails)
const verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15, // max 15 verification attempts per IP per window
  message: { error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Intenta en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Timing-safe string comparison to prevent timing attacks on tokens */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
const MAX_VERIFY_ATTEMPTS = 5; // Max wrong code attempts before invalidation
// After verify-code succeeds, the email is considered verified for this long,
// giving the user time to submit the /register form with the verified email.
const VERIFIED_EMAIL_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface PendingCode {
  code: string;
  expiresAt: number;
  lastSentAt: number;
  email: string;
  attempts: number;
  /** Canal que pidió la persona (para el cooldown de reenvío). */
  channel?: CodeChannel;
  /** Teléfono (formato wa) al que se envió, si fue por WhatsApp/SMS. */
  phone?: string;
}

type CodeChannel = "email" | PhoneChannel;

const pendingCodes = new Map<string, PendingCode>();

// Emails that have successfully completed /verify-code. Used by /register
// (and related flows) to enforce backend email verification.
// If the code went by WhatsApp/SMS, `phone` holds the verified number and
// /register must use that same number.
const verifiedEmails = new Map<string, { expiresAt: number; phone?: string }>();

/**
 * Returns true if the given email currently has a valid verified status and
 * atomically consumes it (single-use). Used by /register to ensure the email
 * was actually verified via /verify-code instead of being trusted from the client.
 * When the code was sent by WhatsApp/SMS, the phone submitted at /register
 * must match the phone that received it.
 */
export function consumeVerifiedEmail(email: string, phone?: string | null): boolean {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  const marker = verifiedEmails.get(normalized);
  if (!marker) return false;
  if (Date.now() > marker.expiresAt) {
    verifiedEmails.delete(normalized);
    return false;
  }
  if (marker.phone && normalizePhoneForWhatsApp(phone) !== marker.phone) return false;
  verifiedEmails.delete(normalized);
  return true;
}

// Cleanup expired codes / verified markers every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingCodes) {
    if (entry.expiresAt < now) pendingCodes.delete(key);
  }
  for (const [key, marker] of verifiedEmails) {
    if (marker.expiresAt < now) verifiedEmails.delete(key);
  }
}, 5 * 60 * 1000);

function generateCode(): string {
  const { randomInt } = require("crypto");
  return String(randomInt(100000, 999999));
}

function buildEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#070816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070816;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1),rgba(59,130,246,0.08));border:1px solid rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;">
          <!-- Header with logo -->
          <tr>
            <td align="center" style="padding:40px 30px 20px;">
              <img src="https://uzeed.cl/brand/isotipo-new.png" alt="UZEED" width="80" height="80" style="display:block;border-radius:20px;" />
            </td>
          </tr>
          <!-- Title -->
          <tr>
            <td align="center" style="padding:0 30px 8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Verifica tu cuenta</h1>
            </td>
          </tr>
          <!-- Subtitle -->
          <tr>
            <td align="center" style="padding:0 30px 30px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Ingresa el siguiente código en la app para completar tu registro.</p>
            </td>
          </tr>
          <!-- Code box -->
          <tr>
            <td align="center" style="padding:0 30px 12px;">
              <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:24px 32px;display:inline-block;">
                <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#e879f9;font-family:'SF Mono',Consolas,monospace;">${code}</span>
              </div>
            </td>
          </tr>
          <!-- Expiry note -->
          <tr>
            <td align="center" style="padding:8px 30px 40px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Este código expira en 10 minutos.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 30px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
                Si no solicitaste este código, puedes ignorar este email.<br/>
                &copy; UZEED — uzeed.cl
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

verificationRouter.post(
  "/send-code",
  sendCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email, phone } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "EMAIL_REQUIRED" });
    }
    const requested: CodeChannel =
      req.body.channel === "whatsapp" || req.body.channel === "sms" ? req.body.channel : "email";
    const rawPhone = typeof phone === "string" ? phone : "";

    const normalizedEmail = email.trim().toLowerCase();

    // Reject obviously malformed emails to avoid sending bogus codes
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "EMAIL_INVALID", message: "Correo inválido." });
    }

    // Block code sending for emails that are already registered. This prevents
    // (a) email bombing of existing users and (b) wasted verification flows
    // that would ultimately fail at /register with EMAIL_IN_USE.
    const alreadyRegistered = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (alreadyRegistered) {
      return res.status(409).json({
        error: "EMAIL_IN_USE",
        message: "Este correo ya está registrado. Inicia sesión o recupera tu contraseña.",
      });
    }

    const existing = pendingCodes.get(normalizedEmail);

    // Cambiar de canal (ej. "no me llegó el email, mándalo por WhatsApp") no
    // espera el cooldown; reenviar por el mismo canal sí.
    if (
      existing &&
      (existing.channel ?? "email") === requested &&
      Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS
    ) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000
      );
      return res.status(429).json({
        error: "COOLDOWN",
        message: `Debes esperar ${waitSeconds} segundos antes de reenviar.`,
        waitSeconds,
      });
    }

    const code = generateCode();
    const entry: PendingCode = {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
      lastSentAt: Date.now(),
      email: normalizedEmail,
      attempts: 0,
      channel: requested,
    };

    const sendByPhone = async () => {
      if (!rawPhone) return null;
      const sent = await sendCodeToPhone(rawPhone, code, requested === "sms" ? "sms" : "whatsapp");
      if (!sent.ok) {
        console.error("[verification] phone code failed", { email: normalizedEmail, reason: sent.error });
        return sent;
      }
      entry.phone = sent.to;
      pendingCodes.set(normalizedEmail, entry);
      return sent;
    };

    if (requested !== "email") {
      const sent = await sendByPhone();
      if (!sent || !sent.ok) {
        const error = sent?.error ?? "PHONE_REQUIRED";
        const message =
          error === "PHONE_DAILY_LIMIT"
            ? "Alcanzaste el máximo de códigos por hoy para este número."
            : error === "INVALID_PHONE" || error === "PHONE_REQUIRED"
              ? "El número de teléfono no es válido."
              : "No pudimos enviar el código a tu teléfono. Intenta por email.";
        return res.status(error === "PHONE_DAILY_LIMIT" ? 429 : 503).json({ error, message });
      }
      return res.json({
        ok: true,
        channel: sent.channel,
        destination: sent.destination,
        expiresInSeconds: CODE_TTL_MS / 1000,
      });
    }

    pendingCodes.set(normalizedEmail, entry);

    if (config.resendApiKey || smtpConfigured()) {
      const sent = await sendMail({
        to: normalizedEmail,
        subject: "Código de verificación — UZEED",
        html: buildEmailHtml(code),
        text: `Tu código de verificación UZEED es: ${code}. Vence en 10 minutos.`,
        priority: "critical",
      });
      if (!sent.ok) {
        console.error("[verification] send code failed", { email: normalizedEmail, reason: sent.reason });
        // El email no salió: si hay teléfono, el mismo código va por WhatsApp/SMS.
        const byPhone = await sendByPhone();
        if (byPhone?.ok) {
          return res.json({
            ok: true,
            channel: byPhone.channel,
            destination: byPhone.destination,
            fallback: true,
            expiresInSeconds: CODE_TTL_MS / 1000,
          });
        }
        // Libera el cooldown para que pueda reintentar apenas se recupere el envío.
        pendingCodes.delete(normalizedEmail);
        return res.status(503).json({
          error: "EMAIL_SEND_FAILED",
          message: "No pudimos enviar el correo en este momento. Intenta nuevamente en unos minutos.",
          phoneChannels: phoneCodeChannels(),
        });
      }
    } else {
      console.warn("[verification] RESEND_API_KEY not set — cannot send verification email");
    }

    return res.json({
      ok: true,
      channel: "email",
      destination: normalizedEmail,
      expiresInSeconds: CODE_TTL_MS / 1000,
    });
  })
);

/** Canales disponibles para recibir el código de registro. */
verificationRouter.get("/channels", (_req, res) => {
  res.json({ email: true, phone: phoneCodeChannels() });
});

verificationRouter.post(
  "/verify-code"
,
  verifyCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const entry = pendingCodes.get(normalizedEmail);

    if (!entry) {
      return res
        .status(400)
        .json({ error: "CODE_NOT_FOUND", message: "No hay un código pendiente para este email." });
    }

    if (Date.now() > entry.expiresAt) {
      pendingCodes.delete(normalizedEmail);
      return res
        .status(400)
        .json({ error: "CODE_EXPIRED", message: "El código ha expirado. Solicita uno nuevo." });
    }

    const submittedCode = String(code).trim();
    if (!safeCompare(entry.code, submittedCode)) {
      entry.attempts++;
      if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
        pendingCodes.delete(normalizedEmail);
        return res
          .status(429)
          .json({ error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Solicita un nuevo código." });
      }
      return res
        .status(400)
        .json({ error: "CODE_INVALID", message: "El código ingresado no es correcto." });
    }

    pendingCodes.delete(normalizedEmail);
    // Mark this email as verified so the subsequent /register call can
    // enforce that email verification actually happened on the backend.
    verifiedEmails.set(normalizedEmail, {
      expiresAt: Date.now() + VERIFIED_EMAIL_TTL_MS,
      phone: entry.phone,
    });
    return res.json({ ok: true, verified: true });
  })
);

// ─── Password Reset ───

const pendingResetCodes = new Map<string, PendingCode>();

// One-time reset tokens: after code is verified, a secure token is issued
// that must be presented to /reset-password. This prevents code reuse.
interface ResetToken {
  email: string;
  expiresAt: number;
}
const pendingResetTokens = new Map<string, ResetToken>();

/* Topes diarios por correo, además de los de IP. Con códigos de 6 dígitos,
   pedir uno nuevo cada 2 minutos y rotar IPs permitía ir probando miles de
   códigos por día contra una cuenta puntual hasta adivinar uno. Con esto,
   cada correo tiene como máximo RESET_MAX_FAILS_PER_DAY intentos fallidos. */
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;
const RESET_MAX_SENDS_PER_DAY = 5;
const RESET_MAX_FAILS_PER_DAY = 10;
type DailyCounter = { count: number; windowStart: number };
const resetSendsByEmail = new Map<string, DailyCounter>();
const resetFailsByEmail = new Map<string, DailyCounter>();

function dailyCount(map: Map<string, DailyCounter>, key: string): number {
  const entry = map.get(key);
  if (!entry || Date.now() - entry.windowStart > RESET_WINDOW_MS) return 0;
  return entry.count;
}

function bumpDaily(map: Map<string, DailyCounter>, key: string) {
  const entry = map.get(key);
  if (!entry || Date.now() - entry.windowStart > RESET_WINDOW_MS) {
    map.set(key, { count: 1, windowStart: Date.now() });
  } else {
    entry.count++;
  }
}

// Cleanup expired reset codes and tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of pendingResetCodes) {
    if (entry.expiresAt < now) pendingResetCodes.delete(key);
  }
  for (const [key, entry] of pendingResetTokens) {
    if (entry.expiresAt < now) pendingResetTokens.delete(key);
  }
  for (const map of [resetSendsByEmail, resetFailsByEmail]) {
    for (const [key, entry] of map) {
      if (now - entry.windowStart > RESET_WINDOW_MS) map.delete(key);
    }
  }
}, 5 * 60 * 1000);

function buildResetEmailHtml(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#070816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070816;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1),rgba(59,130,246,0.08));border:1px solid rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:40px 30px 20px;">
              <img src="https://uzeed.cl/brand/isotipo-new.png" alt="UZEED" width="80" height="80" style="display:block;border-radius:20px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Restablecer contraseña</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 30px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Ingresa el siguiente código para restablecer tu contraseña.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 12px;">
              <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:24px 32px;display:inline-block;">
                <span style="font-size:36px;font-weight:800;letter-spacing:12px;color:#e879f9;font-family:'SF Mono',Consolas,monospace;">${code}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 30px 40px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Este código expira en 10 minutos.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 30px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
                Si no solicitaste este código, puedes ignorar este email.<br/>
                &copy; UZEED — uzeed.cl
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

verificationRouter.post(
  "/send-reset-code",
  sendCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "EMAIL_REQUIRED" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Always perform the same work regardless of whether user exists
    // to prevent email enumeration via timing side-channel
    const existing = pendingResetCodes.get(normalizedEmail);
    if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000
      );
      return res.status(429).json({
        error: "COOLDOWN",
        message: `Debes esperar ${waitSeconds} segundos antes de reenviar.`,
        waitSeconds,
      });
    }

    if (
      dailyCount(resetSendsByEmail, normalizedEmail) >= RESET_MAX_SENDS_PER_DAY ||
      dailyCount(resetFailsByEmail, normalizedEmail) >= RESET_MAX_FAILS_PER_DAY
    ) {
      return res.status(429).json({
        error: "TOO_MANY_ATTEMPTS",
        message: "Se pidieron demasiados códigos para este correo. Intenta mañana o escríbenos a soporte.",
      });
    }
    bumpDaily(resetSendsByEmail, normalizedEmail);

    const code = generateCode();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always store a cooldown entry (even for non-existing users) so the
    // cooldown behavior is identical and doesn't leak user existence.
    pendingResetCodes.set(normalizedEmail, {
      code,
      expiresAt: Date.now() + CODE_TTL_MS,
      lastSentAt: Date.now(),
      email: normalizedEmail,
      attempts: 0,
    });

    // Only send the email if the user actually exists
    if (user && (config.resendApiKey || smtpConfigured())) {
      const sent = await sendMail({
        to: normalizedEmail,
        subject: "Restablecer contraseña — UZEED",
        html: buildResetEmailHtml(code),
        text: `Tu código para restablecer la contraseña de UZEED es: ${code}. Vence en 10 minutos.`,
        priority: "critical",
      });
      if (!sent.ok) {
        // Don't reveal email send failure to prevent enumeration
        console.error("[verification] reset code send failed", { email: normalizedEmail, reason: sent.reason });
      }
    } else if (user) {
      console.warn("[verification] RESEND_API_KEY not set — cannot send reset email");
    }

    // Always return identical response regardless of user existence
    return res.json({ ok: true, expiresInSeconds: CODE_TTL_MS / 1000 });
  })
);

verificationRouter.post(
  "/verify-reset-code",
  verifyCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (dailyCount(resetFailsByEmail, normalizedEmail) >= RESET_MAX_FAILS_PER_DAY) {
      pendingResetCodes.delete(normalizedEmail);
      return res.status(429).json({
        error: "TOO_MANY_ATTEMPTS",
        message: "Demasiados intentos fallidos para este correo. Intenta mañana.",
      });
    }
    const entry = pendingResetCodes.get(normalizedEmail);

    if (!entry) {
      return res
        .status(400)
        .json({ error: "CODE_NOT_FOUND", message: "No hay un código pendiente para este email." });
    }

    if (Date.now() > entry.expiresAt) {
      pendingResetCodes.delete(normalizedEmail);
      return res
        .status(400)
        .json({ error: "CODE_EXPIRED", message: "El código ha expirado. Solicita uno nuevo." });
    }

    const submittedResetCode = String(code).trim();
    if (!safeCompare(entry.code, submittedResetCode)) {
      entry.attempts++;
      bumpDaily(resetFailsByEmail, normalizedEmail);
      if (entry.attempts >= MAX_VERIFY_ATTEMPTS) {
        pendingResetCodes.delete(normalizedEmail);
        return res
          .status(429)
          .json({ error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Solicita un nuevo código." });
      }
      return res
        .status(400)
        .json({ error: "CODE_INVALID", message: "El código ingresado no es correcto." });
    }

    // Code verified — delete it and issue a one-time reset token
    pendingResetCodes.delete(normalizedEmail);
    const resetToken = crypto.randomBytes(32).toString("hex");
    pendingResetTokens.set(resetToken, {
      email: normalizedEmail,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes to use the token
    });

    return res.json({ ok: true, verified: true, resetToken });
  })
);

verificationRouter.post(
  "/reset-password",
  verifyCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email, resetToken, newPassword } = req.body;
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        error: "PASSWORD_TOO_SHORT",
        message: "La contraseña debe tener al menos 8 caracteres.",
      });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({
        error: "PASSWORD_TOO_LONG",
        message: "La contraseña no puede tener más de 128 caracteres.",
      });
    }

    // Validate the one-time reset token (issued by verify-reset-code)
    const tokenEntry = pendingResetTokens.get(String(resetToken));
    if (!tokenEntry) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "El enlace de restablecimiento no es válido. Solicita uno nuevo.",
      });
    }

    if (Date.now() > tokenEntry.expiresAt) {
      pendingResetTokens.delete(String(resetToken));
      return res.status(400).json({
        error: "TOKEN_EXPIRED",
        message: "El enlace de restablecimiento ha expirado. Solicita uno nuevo.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (tokenEntry.email !== normalizedEmail) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "El enlace de restablecimiento no es válido.",
      });
    }

    // Token is valid — consume it immediately (one-time use)
    pendingResetTokens.delete(String(resetToken));

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Invalidate all active sessions for this user
    try {
      const pattern = `%"userId":"${user.id}"%`;
      await prisma.$executeRaw`DELETE FROM "session" WHERE sess::text LIKE ${pattern}`;
    } catch (err) {
      console.error("[verification] failed to invalidate sessions", err);
    }

    return res.json({ ok: true });
  })
);

/* ── Set password (for quick-register flow) ── */

function buildSetPasswordEmailHtml(link: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#070816;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#070816;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(236,72,153,0.1),rgba(59,130,246,0.08));border:1px solid rgba(255,255,255,0.1);border-radius:24px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:40px 30px 20px;">
              <img src="https://uzeed.cl/brand/isotipo-new.png" alt="UZEED" width="80" height="80" style="display:block;border-radius:20px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 8px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">Tu perfil fue creado</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 30px;">
              <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.6);line-height:1.5;">Un administrador revisará tu perfil pronto. Mientras tanto, crea tu contraseña para acceder a tu cuenta y completar tu perfil.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 30px 12px;">
              <a href="${link}" style="display:inline-block;background:linear-gradient(135deg,#d946ef,#8b5cf6);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">Crear contraseña</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 30px 40px;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.4);">Este enlace expira en 72 horas.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 30px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.3);line-height:1.5;">
                Si no creaste este perfil, puedes ignorar este email.<br/>
                &copy; UZEED — uzeed.cl
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendSetPasswordEmail(email: string, token: string) {
  const appUrl = config.appUrl.replace(/\/$/, "");
  const link = `${appUrl}/crear-contrasena?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

  if (!config.resendApiKey && !smtpConfigured()) {
    console.log("[verification] set-password email (no API key):", link);
    return;
  }

  const sent = await sendMail({
    to: email,
    subject: "Crea tu contraseña — UZEED",
    html: buildSetPasswordEmailHtml(link),
    text: `Crea tu contraseña de UZEED aquí: ${link}`,
    priority: "critical",
  });
  if (!sent.ok) throw new Error(`set-password email failed: ${sent.reason}`);
}

/**
 * Resend the "create your password" email for a professional that registered
 * via /publicate but lost the original email. This only regenerates a fresh
 * passwordSetToken if the user has NOT yet set a password (passwordHash is
 * null); users that already have a password must use the normal password
 * reset flow (/forgot-password).
 *
 * To prevent email enumeration the response is uniform regardless of whether
 * the email exists or whether the user has a password already set.
 */
const SET_PASSWORD_TOKEN_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours
const resendSetPasswordCooldown = new Map<string, number>(); // email -> lastSentAt

verificationRouter.post(
  "/resend-set-password",
  sendCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "EMAIL_REQUIRED" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: "EMAIL_INVALID", message: "Correo inválido." });
    }

    // Per-email cooldown (2 min) — same UX as send-reset-code.
    const lastSentAt = resendSetPasswordCooldown.get(normalizedEmail);
    if (lastSentAt && Date.now() - lastSentAt < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil(
        (RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000
      );
      return res.status(429).json({
        error: "COOLDOWN",
        message: `Debes esperar ${waitSeconds} segundos antes de reenviar.`,
        waitSeconds,
      });
    }

    // Always mark cooldown to keep timing uniform regardless of user state.
    resendSetPasswordCooldown.set(normalizedEmail, Date.now());

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, passwordHash: true },
    });

    // Only regenerate + send when the user exists AND has not yet set a
    // password. Otherwise stay silent (no enumeration leak). Users with an
    // existing password should use /forgot-password.
    if (user && !user.passwordHash) {
      const newToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + SET_PASSWORD_TOKEN_TTL_MS);
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            passwordSetToken: newToken,
            passwordSetTokenExpiresAt: expiresAt,
          },
        });
        await sendSetPasswordEmail(normalizedEmail, newToken);
      } catch (err) {
        console.error("[verification] resend set-password failed", err);
        // Don't leak failure; uniform response below.
      }
    }

    return res.json({ ok: true });
  })
);

// Cleanup stale resend-set-password cooldown entries every 15 minutes.
setInterval(() => {
  const now = Date.now();
  for (const [key, sentAt] of resendSetPasswordCooldown) {
    if (now - sentAt > RESEND_COOLDOWN_MS) resendSetPasswordCooldown.delete(key);
  }
}, 15 * 60 * 1000);

verificationRouter.post(
  "/set-password",
  verifyCodeLimiter,
  asyncHandler(async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({
        error: "PASSWORD_TOO_SHORT",
        message: "La contraseña debe tener al menos 8 caracteres.",
      });
    }
    if (newPassword.length > 128) {
      return res.status(400).json({
        error: "PASSWORD_TOO_LONG",
        message: "La contraseña no puede tener más de 128 caracteres.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }

    if (!user.passwordSetToken || !safeCompare(user.passwordSetToken, String(token))) {
      return res.status(400).json({
        error: "INVALID_TOKEN",
        message: "El enlace no es válido. Solicita uno nuevo.",
      });
    }

    if (user.passwordSetTokenExpiresAt && Date.now() > user.passwordSetTokenExpiresAt.getTime()) {
      return res.status(400).json({
        error: "TOKEN_EXPIRED",
        message: "El enlace ha expirado. Solicita uno nuevo.",
      });
    }

    const passwordHash = await argon2.hash(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordSetToken: null,
        passwordSetTokenExpiresAt: null,
      },
    });

    // Auto-login: regenerate session to prevent session fixation, then
    // set the authenticated userId/role on the fresh session.
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });
    req.session.userId = user.id;
    req.session.role = user.role;
    await new Promise<void>((resolve, reject) => {
      req.session.save((err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        profileType: user.profileType,
      },
    });
  })
);
