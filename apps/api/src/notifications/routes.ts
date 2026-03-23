import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { removePushSubscription, savePushSubscription, sendPushToUsers } from "./push";

export const notificationsRouter = Router();


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
