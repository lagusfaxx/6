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

// ✅ Public platform stats for homepage counters
statsRouter.get("/stats/platform", asyncHandler(async (_req, res) => {
  const [professionals, services] = await Promise.all([
    prisma.user.count({ where: { profileType: "PROFESSIONAL" } }),
    prisma.serviceRequest.count({ where: { status: "FINALIZADO" } }),
  ]);

  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
  return res.json({ professionals, services });
}));
