import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { removePushSubscription, savePushSubscription, sendPushToUsers } from "./push";
import {
  getWhatsAppProvider,
  isWhatsAppConfigured,
  logDelivery,
  normalizePhoneForWhatsApp,
  sendWhatsAppNotification,
  sendTestChat,
  smsNotificationText,
} from "./whatsapp";
import { getSmsBalance, isSmsConfigured, sendSms } from "./sms";
import {
  findReminderTargets,
  isQuietHours,
  isReminderRunning,
  reminderText,
  startUnreadReminder,
} from "./unreadReminder";
import { getBaileysQrDataUrl, getBaileysStatus, logoutBaileys } from "./whatsappBaileys";
import { verifyEmailPrefsToken } from "../lib/emailPrefsToken";

export const notificationsRouter = Router();

/* ── Bot de WhatsApp: diagnóstico, vinculación y prueba (solo admin) ── */

notificationsRouter.get("/notifications/whatsapp/status", requireAdmin, asyncHandler(async (_req, res) => {
  return res.json({
    configured: isWhatsAppConfigured(),
    provider: getWhatsAppProvider(),
    baileys: getBaileysStatus(),
    cloudTemplate: process.env.WHATSAPP_TEMPLATE_NAME || "uzeed_notificacion",
    sms: {
      configured: isSmsConfigured(),
      mode: isSmsConfigured() ? (process.env.SMS_MODE === "primary" ? "primary" : "fallback") : null,
    },
  });
}));

/* QR de vinculación de Baileys. Abrir en el navegador con sesión admin y
   escanear desde WhatsApp (Dispositivos vinculados) del chip del bot.
   Con ?format=json devuelve { dataUrl } para incrustarlo en el panel. */
notificationsRouter.get("/notifications/whatsapp/qr", requireAdmin, asyncHandler(async (req, res) => {
  const dataUrl = await getBaileysQrDataUrl();
  if (!dataUrl) {
    const status = getBaileysStatus();
    return res.status(404).json({ error: "NO_QR_PENDING", status });
  }
  if (req.query.format === "json") {
    res.setHeader("Cache-Control", "no-store");
    return res.json({ dataUrl });
  }
  const img = Buffer.from(dataUrl.split(",")[1], "base64");
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "no-store");
  return res.send(img);
}));

/* Desvincula el número actual (borra la sesión) para conectar otro chip. */
notificationsRouter.post("/notifications/whatsapp/logout", requireAdmin, asyncHandler(async (_req, res) => {
  await logoutBaileys();
  return res.json({ ok: true, status: getBaileysStatus() });
}));

/* Recordatorio por SMS a profesionales con mensajes sin leer. Dos pasos:
   GET devuelve la vista previa; POST envía con `confirm` = cantidad vista,
   así no se manda a un grupo distinto del que el admin aprobó. */
function reminderDays(raw: unknown): number {
  const n = Number(raw);
  return [7, 30, 90].includes(n) ? n : 30;
}

notificationsRouter.get("/notifications/sms/unread-reminder", requireAdmin, asyncHandler(async (req, res) => {
  const days = reminderDays(req.query.days);
  const { targets, skippedRecent, skippedNoPhone } = await findReminderTargets(prisma as any, days);
  return res.json({
    days,
    count: targets.length,
    unreadMessages: targets.reduce((sum, t) => sum + t.unread, 0),
    skippedRecent,
    skippedNoPhone,
    example: reminderText(targets[0]?.unread ?? 3),
    smsConfigured: isSmsConfigured(),
    quietHours: isQuietHours(),
    running: isReminderRunning(),
  });
}));

notificationsRouter.post("/notifications/sms/unread-reminder", requireAdmin, asyncHandler(async (req, res) => {
  if (!isSmsConfigured()) return res.status(503).json({ ok: false, error: "SMS_NOT_CONFIGURED" });
  if (isQuietHours()) return res.status(409).json({ ok: false, error: "HORARIO_NOCTURNO" });
  if (isReminderRunning()) return res.status(409).json({ ok: false, error: "YA_EN_CURSO" });
  const days = reminderDays(req.body?.days);
  const { targets } = await findReminderTargets(prisma as any, days);
  if (Number(req.body?.confirm) !== targets.length) {
    return res.status(409).json({ ok: false, error: "CAMBIO_LA_CANTIDAD", count: targets.length });
  }
  if (!targets.length) return res.json({ ok: true, started: false, count: 0 });
  const started = startUnreadReminder(prisma as any, targets);
  return res.status(started ? 202 : 409).json({ ok: started, started, count: targets.length });
}));

/* Estadísticas de avisos enviados por SMS y WhatsApp (panel /admin/whatsapp). */
notificationsRouter.get("/notifications/whatsapp/stats", requireAdmin, asyncHandler(async (_req, res) => {
  const now = Date.now();
  const since = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000);
  const count = (channel: string, days: number, ok?: boolean) =>
    prisma.notificationDelivery.count({
      where: { channel, createdAt: { gte: since(days) }, ...(ok === undefined ? {} : { ok }) },
    });

  const [sms1, sms7, sms30, smsFail30, wa1, wa7, wa30, waFail30, byType, recent, balance] = await Promise.all([
    count("SMS", 1, true),
    count("SMS", 7, true),
    count("SMS", 30, true),
    count("SMS", 30, false),
    count("WHATSAPP", 1, true),
    count("WHATSAPP", 7, true),
    count("WHATSAPP", 30, true),
    count("WHATSAPP", 30, false),
    prisma.notificationDelivery.groupBy({
      by: ["channel", "type"],
      where: { ok: true, createdAt: { gte: since(30) } },
      _count: { _all: true },
    }),
    prisma.notificationDelivery.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, userId: true, channel: true, type: true, ok: true, error: true, createdAt: true },
    }),
    getSmsBalance(),
  ]);

  const userIds = [...new Set(recent.map((r) => r.userId).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true, username: true } })
    : [];
  const names = new Map(users.map((u) => [u.id, u.displayName || u.username]));

  return res.json({
    sms: { last24h: sms1, last7d: sms7, last30d: sms30, failed30d: smsFail30, balance },
    whatsapp: { last24h: wa1, last7d: wa7, last30d: wa30, failed30d: waFail30 },
    byType: byType.map((r) => ({ channel: r.channel, type: r.type, count: r._count._all })),
    recent: recent.map((r) => ({ ...r, userName: r.userId ? names.get(r.userId) ?? null : null })),
  });
}));

/* Prueba de punta a punta: aviso de chat al WhatsApp del admin y, al
   responderlo, confirmación del webhook. No crea mensajes reales. */
notificationsRouter.post("/notifications/whatsapp/test-chat", requireAdmin, asyncHandler(async (req, res) => {
  let phone = String(req.body?.phone || "").trim();
  if (!phone) {
    const me = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { phone: true } });
    phone = me?.phone || "";
  }
  if (!phone) return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });
  const result = await sendTestChat(prisma as any, req.session.userId!, phone);
  return res.status(result.ok ? 200 : 502).json(result);
}));

notificationsRouter.post("/notifications/whatsapp/test", requireAdmin, asyncHandler(async (req, res) => {
  const viaSms = req.body?.channel === "sms";
  if (viaSms ? !isSmsConfigured() : !isWhatsAppConfigured()) {
    return res.status(503).json({ ok: false, error: viaSms ? "SMS_NOT_CONFIGURED" : "WHATSAPP_NOT_CONFIGURED" });
  }
  let phone = String(req.body?.phone || "").trim();
  if (!phone) {
    const me = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { phone: true },
    });
    phone = me?.phone || "";
  }
  if (!phone) return res.status(400).json({ ok: false, error: "PHONE_REQUIRED" });

  const info = "el bot de avisos de UZEED está funcionando correctamente";
  if (viaSms) {
    const to = normalizePhoneForWhatsApp(phone);
    if (!to) return res.status(400).json({ ok: false, error: "INVALID_PHONE" });
    const result = await sendSms(to, smsNotificationText(info));
    await logDelivery(prisma, { userId: req.session.userId, channel: "SMS", type: "TEST", result });
    return res.status(result.ok ? 200 : 502).json(result);
  }
  const result = await sendWhatsAppNotification(phone, "Prueba", info);
  await logDelivery(prisma, { userId: req.session.userId, channel: "WHATSAPP", type: "TEST", result });
  return res.status(result.ok ? 200 : 502).json(result);
}));


notificationsRouter.post("/notifications/push/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const subscription = req.body?.subscription;

  if (!subscription || typeof subscription !== "object") {
    return res.status(400).json({ error: "INVALID_SUBSCRIPTION" });
  }
  if (!subscription.endpoint || typeof subscription.endpoint !== "string") {
    return res.status(400).json({ error: "ENDPOINT_REQUIRED" });
  }
  if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
    return res.status(400).json({ error: "KEYS_REQUIRED" });
  }

  await savePushSubscription(prisma as any, userId, subscription, req.get("user-agent"));
  try {
    const endpoint = String(subscription.endpoint).trim();
    const host = endpoint ? new URL(endpoint).host : "";
    if (host) {
      console.info("[webpush] subscription saved", { userId, endpointHost: host });
    }
  } catch {
    // ignore logging errors
  }
  return res.json({ ok: true });
}));

notificationsRouter.post("/notifications/push/unsubscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const endpoint = String(req.body?.endpoint || "").trim();
  if (!endpoint) return res.status(400).json({ error: "ENDPOINT_REQUIRED" });

  const removed = await removePushSubscription(prisma as any, userId, endpoint);
  return res.json({ ok: true, removed: removed.count });
}));

notificationsRouter.post("/notifications/push/test", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;

  const result = await sendPushToUsers(prisma as any, [userId], {
    title: "Notificación de prueba",
    body: "Push habilitado correctamente en UZEED",
    data: { url: "/" },
    tag: "push-test"
  });

  // Return real delivery attempt information so iOS failures are visible.
  return res.json({ ok: true, ...result });
}));

/* ── Preferencias de correo ── */

notificationsRouter.get("/notifications/email/preferences", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailOnNewMessage: true },
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
  return res.json({ emailOnNewMessage: user.emailOnNewMessage });
}));

notificationsRouter.patch("/notifications/email/preferences", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const value = req.body?.emailOnNewMessage;
  if (typeof value !== "boolean") {
    return res.status(400).json({ error: "INVALID_VALUE" });
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailOnNewMessage: value },
    select: { emailOnNewMessage: true },
  });
  return res.json({ emailOnNewMessage: user.emailOnNewMessage });
}));

/**
 * Baja desde el enlace del correo. Es pública a propósito: quien abre el
 * enlace puede no tener sesión en ese dispositivo. La autorización es la
 * firma HMAC del token, que solo se puede generar con SESSION_SECRET.
 */
notificationsRouter.post("/notifications/email/unsubscribe", asyncHandler(async (req, res) => {
  const userId = String(req.body?.uid || "");
  const token = String(req.body?.token || "");
  if (!verifyEmailPrefsToken(userId, token)) {
    return res.status(403).json({ error: "INVALID_TOKEN" });
  }
  // updateMany en vez de update: un id válido pero inexistente no debe
  // devolver 500 ni revelar si la cuenta existe.
  await prisma.user.updateMany({
    where: { id: userId },
    data: { emailOnNewMessage: false },
  });
  return res.json({ ok: true });
}));

notificationsRouter.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const skip = (page - 1) * limit;
  const unreadOnly = req.query.unread === "true";

  const where: any = { userId };
  if (unreadOnly) {
    where.readAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, readAt: null } })
  ]);

  return res.json({ notifications, total, unreadCount, page, pages: Math.ceil(total / limit) });
}));

notificationsRouter.post("/notifications/read-all", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const updated = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() }
  });
  return res.json({ ok: true, updated: updated.count });
}));

notificationsRouter.post("/notifications/:id/read", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = req.params.id;

  const notification = await prisma.notification.findFirst({ where: { id, userId } });
  if (!notification) {
    return res.status(404).json({ error: "NOTIFICATION_NOT_FOUND" });
  }
  if (notification.readAt) {
    return res.json({ ok: true, updated: 0, alreadyRead: true });
  }

  const updated = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() }
  });
  return res.json({ ok: true, updated: updated.count });
}));

notificationsRouter.post("/notifications/delete-all", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const deleted = await prisma.notification.deleteMany({ where: { userId } });
  return res.json({ ok: true, deleted: deleted.count });
}));
