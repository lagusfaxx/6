import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const statsRouter = Router();


const AVAILABLE_WINDOW_MINUTES = 10;

statsRouter.get("/stats/available-now", asyncHandler(async (_req, res) => {
  const threshold = new Date(Date.now() - AVAILABLE_WINDOW_MINUTES * 60 * 1000);

  const total = await prisma.user.count({
    where: {
      isActive: true,
      lastSeen: { gte: threshold },
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] }
    }
  });

  return res.json({ total, windowMinutes: AVAILABLE_WINDOW_MINUTES });
}));

statsRouter.get("/stats/me", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const [posts, messagesReceived, subscribers, services] = await Promise.all([
    prisma.post.count({ where: { authorId: userId } }),
    prisma.message.count({ where: { toId: userId } }),
    prisma.profileSubscription.count({
      where: { profileId: userId, status: "ACTIVE", expiresAt: { gt: new Date() } }
    }),
    prisma.serviceItem.count({ where: { ownerId: userId } })
  ]);

  return res.json({ posts, messagesReceived, subscribers, services });
}));
