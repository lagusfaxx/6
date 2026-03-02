import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { removePushSubscription, savePushSubscription, sendPushToUsers } from "./push";

export const notificationsRouter = Router();


notificationsRouter.post("/notifications/push/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const subscription = req.body?.subscription;

  await savePushSubscription(prisma as any, userId, subscription, req.get("user-agent"));
  try {
    const endpoint = String(subscription?.endpoint || "").trim();
    const host = endpoint ? new URL(endpoint).host : "";
    if (host) {
      console.info("[webpush] subscription saved", { userId, endpointHost: host });
    }
  } catch {
    // ignore
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
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });
  return res.json({ notifications });
}));

notificationsRouter.post("/notifications/:id/read", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = req.params.id;
  const updated = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() }
  });
  return res.json({ ok: true, updated: updated.count });
}));
