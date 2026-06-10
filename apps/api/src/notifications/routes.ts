import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { removePushSubscription, savePushSubscription, sendPushToUsers } from "./push";
import { getWhatsAppProvider, isWhatsAppConfigured, sendWhatsAppNotification } from "./whatsapp";
import { getBaileysQrDataUrl, getBaileysStatus, logoutBaileys } from "./whatsappBaileys";

export const notificationsRouter = Router();

/* ── Bot de WhatsApp: diagnóstico, vinculación y prueba (solo admin) ── */

notificationsRouter.get("/notifications/whatsapp/status", requireAdmin, asyncHandler(async (_req, res) => {
  return res.json({
    configured: isWhatsAppConfigured(),
    provider: getWhatsAppProvider(),
    baileys: getBaileysStatus(),
    cloudTemplate: process.env.WHATSAPP_TEMPLATE_NAME || "uzeed_notificacion",
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

notificationsRouter.post("/notifications/whatsapp/test", requireAdmin, asyncHandler(async (req, res) => {
  if (!isWhatsAppConfigured()) {
    return res.status(503).json({ ok: false, error: "WHATSAPP_NOT_CONFIGURED" });
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

  const result = await sendWhatsAppNotification(
    phone,
    "Prueba",
    "el bot de avisos de UZEED está funcionando correctamente",
  );
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
