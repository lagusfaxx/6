import { Router } from "express";
import { prisma } from "../lib/prisma";

export const feedRouter = Router();

feedRouter.get("/feed", async (req, res) => {
  const userId = req.session.userId;
  let hasMembership = false;
  if (userId) {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { membershipExpiresAt: true } });
    if (u?.membershipExpiresAt && u.membershipExpiresAt.getTime() > Date.now()) hasMembership = true;
  }

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { media: true, author: { select: { id: true, displayName: true } } }
  });

  const mapped = posts.map((p) => {
    const paywalled = !p.isPublic && !hasMembership;
    return {
      id: p.id,
      title: p.title,
      body: paywalled ? p.body.slice(0, 140) + (p.body.length > 140 ? "…" : "") : p.body,
      isPublic: p.isPublic,
      paywalled,
      author: p.author,
      createdAt: p.createdAt,
      media: paywalled ? [] : p.media
    };
  });

  res.json({ posts: mapped, hasMembership });
});
