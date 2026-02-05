import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";

export const meRouter = Router();

meRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, displayName: true, role: true, membershipExpiresAt: true } });
  res.json({ user });
});
