import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const statsRouter = Router();

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
