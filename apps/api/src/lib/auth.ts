import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role !== "ADMIN") return res.status(403).json({ error: "FORBIDDEN" });
  next();
}
