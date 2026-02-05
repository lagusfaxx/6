import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const notificationsRouter = Router();

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
