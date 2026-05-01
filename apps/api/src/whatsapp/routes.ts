/**
 * WhatsApp opt-in API + Meta webhook.
 *
 *   POST   /whatsapp/opt-in          start verification: send 6-digit code
 *   POST   /whatsapp/verify          confirm the code, mark user as opted-in
 *   POST   /whatsapp/opt-out         disable WhatsApp delivery
 *   GET    /whatsapp/preferences     read current flags
 *   PATCH  /whatsapp/preferences     update events/messages/reminders flags
 *   POST   /whatsapp/test            send a test message (requires opt-in)
 *
 *   GET    /webhooks/whatsapp        Meta verification handshake (PUBLIC)
 *   POST   /webhooks/whatsapp        inbound message handler (PUBLIC)
 *
 * The webhook routes are mounted on the public allowlist (see
 * apps/api/src/auth/middleware.ts) so Meta can reach them without a session
 * cookie. The handshake is protected by WHATSAPP_VERIFY_TOKEN.
 */

import { Router } from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import {
  bodyParams,
  defaultTemplateLang,
  isWhatsAppConfigured,
  normalizePhone,
  sendTemplate,
  sendText,
} from "./client";
import { markInboundFromPhone, notifyWhatsAppAsync } from "./notify";

export const whatsappRouter = Router();
export const whatsappWebhookRouter = Router();

const optInLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: "TOO_MANY_OPT_IN_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: { error: "TOO_MANY_VERIFY_ATTEMPTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  // 6-digit numeric code, zero-padded
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

async function deliverOtp(phoneE164: string, code: string): Promise<boolean> {
  const otpTemplate = process.env.WHATSAPP_TEMPLATE_OTP;
  if (otpTemplate) {
    const r = await sendTemplate(
      phoneE164,
      otpTemplate,
      [bodyParams(code)],
      defaultTemplateLang(),
    );
    if (r.ok) return true;
    console.warn("[whatsapp] OTP template failed, trying text fallback", { reason: r.error });
  }
  const r = await sendText(
    phoneE164,
    `Tu código de verificación UZEED es ${code}. Vence en 10 minutos. Si no lo solicitaste, ignora este mensaje.`,
  );
  return r.ok;
}

/* ─── opt-in: request OTP ───────────────────────────────────────────── */

whatsappRouter.post(
  "/whatsapp/opt-in",
  requireAuth,
  optInLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    if (!isWhatsAppConfigured()) {
      return res.status(503).json({ error: "WHATSAPP_NOT_CONFIGURED" });
    }

    const rawPhone = String(req.body?.phone || "").trim();
    const phoneE164 = normalizePhone(rawPhone);
    if (!phoneE164 || phoneE164.length < 8) {
      return res.status(400).json({ error: "INVALID_PHONE" });
    }

    // Don't let one user steal another user's verified WhatsApp.
    const owner = await prisma.user.findFirst({
      where: { whatsappNumber: `+${phoneE164}`, whatsappVerifiedAt: { not: null }, NOT: { id: userId } },
      select: { id: true },
    });
    if (owner) {
      return res.status(409).json({ error: "PHONE_ALREADY_LINKED" });
    }

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Invalidate any prior unconsumed OTP for this user
    await prisma.whatsAppOtp.updateMany({
      where: { userId, consumed: false },
      data: { consumed: true },
    });

    await prisma.whatsAppOtp.create({
      data: { userId, phone: `+${phoneE164}`, codeHash, expiresAt },
    });

    const delivered = await deliverOtp(phoneE164, code);
    if (!delivered) {
      return res.status(502).json({ error: "WHATSAPP_DELIVERY_FAILED" });
    }

    return res.json({ ok: true, expiresInSeconds: Math.round(OTP_TTL_MS / 1000) });
  }),
);

/* ─── opt-in: verify OTP ─────────────────────────────────────────────── */

whatsappRouter.post(
  "/whatsapp/verify",
  requireAuth,
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const code = String(req.body?.code || "").trim();
    if (!/^\d{4,8}$/.test(code)) {
      return res.status(400).json({ error: "INVALID_CODE_FORMAT" });
    }

    const otp = await prisma.whatsAppOtp.findFirst({
      where: { userId, consumed: false },
      orderBy: { createdAt: "desc" },
    });
    if (!otp) return res.status(400).json({ error: "NO_PENDING_OTP" });
    if (otp.expiresAt.getTime() < Date.now()) {
      await prisma.whatsAppOtp.update({ where: { id: otp.id }, data: { consumed: true } });
      return res.status(400).json({ error: "OTP_EXPIRED" });
    }
    if (otp.attempts >= MAX_OTP_ATTEMPTS) {
      await prisma.whatsAppOtp.update({ where: { id: otp.id }, data: { consumed: true } });
      return res.status(429).json({ error: "OTP_TOO_MANY_ATTEMPTS" });
    }

    const matches = hashCode(code) === otp.codeHash;
    if (!matches) {
      await prisma.whatsAppOtp.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      return res.status(400).json({ error: "OTP_INVALID" });
    }

    await prisma.$transaction([
      prisma.whatsAppOtp.update({ where: { id: otp.id }, data: { consumed: true } }),
      prisma.user.update({
        where: { id: userId },
        data: {
          whatsappNumber: otp.phone,
          whatsappOptIn: true,
          whatsappVerifiedAt: new Date(),
        },
      }),
    ]);

    // Welcome message — sets up the 24h window so future free-form sends work.
    notifyWhatsAppAsync(userId, {
      type: "ADMIN_EVENT",
      title: "WhatsApp activado",
      body: "A partir de ahora recibirás eventos importantes y avisos de mensajes pendientes por aquí. Responde STOP en cualquier momento para desactivar.",
    });

    return res.json({ ok: true });
  }),
);

/* ─── opt-out ────────────────────────────────────────────────────────── */

whatsappRouter.post(
  "/whatsapp/opt-out",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    await prisma.user.update({
      where: { id: userId },
      data: { whatsappOptIn: false },
    });
    return res.json({ ok: true });
  }),
);

/* ─── preferences ────────────────────────────────────────────────────── */

whatsappRouter.get(
  "/whatsapp/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        whatsappNumber: true,
        whatsappOptIn: true,
        whatsappVerifiedAt: true,
        whatsappEvents: true,
        whatsappMessages: true,
        whatsappReminders: true,
      },
    });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    return res.json({
      configured: isWhatsAppConfigured(),
      number: user.whatsappNumber,
      optIn: user.whatsappOptIn,
      verifiedAt: user.whatsappVerifiedAt,
      preferences: {
        events: user.whatsappEvents,
        messages: user.whatsappMessages,
        reminders: user.whatsappReminders,
      },
    });
  }),
);

whatsappRouter.patch(
  "/whatsapp/preferences",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const data: Record<string, boolean> = {};
    for (const key of ["events", "messages", "reminders"] as const) {
      if (typeof req.body?.[key] === "boolean") {
        data[`whatsapp${key.charAt(0).toUpperCase()}${key.slice(1)}`] = req.body[key];
      }
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: "NO_FIELDS_TO_UPDATE" });
    }
    await prisma.user.update({ where: { id: userId }, data });
    return res.json({ ok: true });
  }),
);

/* ─── test message ───────────────────────────────────────────────────── */

whatsappRouter.post(
  "/whatsapp/test",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const result = await import("./notify").then((m) =>
      m.notifyWhatsApp(userId, {
        type: "ADMIN_EVENT",
        title: "Notificación de prueba",
        body: "WhatsApp está conectado correctamente con UZEED.",
        url: "/",
      }),
    );
    return res.json(result);
  }),
);

/* ─── Meta webhook: GET handshake ────────────────────────────────────── */

whatsappWebhookRouter.get("/webhooks/whatsapp", (req, res) => {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && verifyToken && token === verifyToken && typeof challenge === "string") {
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: "VERIFICATION_FAILED" });
});

/* ─── Meta webhook: POST inbound events ─────────────────────────────── */

whatsappWebhookRouter.post("/webhooks/whatsapp", asyncHandler(async (req, res) => {
  // Always 200 quickly so Meta doesn't retry on transient errors.
  res.status(200).json({ ok: true });

  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const messages = change?.value?.messages || [];
        for (const message of messages) {
          const fromRaw = String(message?.from || "");
          if (!fromRaw) continue;
          const userId = await markInboundFromPhone(`+${fromRaw}`);
          if (!userId) continue;

          const text = message?.text?.body?.trim()?.toLowerCase() || "";
          if (text === "stop" || text === "baja" || text === "salir") {
            await prisma.user.update({
              where: { id: userId },
              data: { whatsappOptIn: false },
            });
            await sendText(
              fromRaw,
              "Listo. Ya no recibirás más notificaciones por WhatsApp. Puedes reactivarlas desde tu perfil en UZEED.",
            ).catch(() => {});
          } else if (text === "start" || text === "alta" || text === "activar") {
            await prisma.user.update({
              where: { id: userId },
              data: { whatsappOptIn: true },
            });
            await sendText(
              fromRaw,
              "WhatsApp reactivado. Volverás a recibir avisos de eventos y mensajes pendientes.",
            ).catch(() => {});
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[whatsapp] webhook handler failed", { err: err?.message });
  }
}));
