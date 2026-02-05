import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { env } from "../lib/env";
import { loginInputSchema, registerInputSchema } from "@uzeed/shared";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const parsed = registerInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  const { email, password, displayName } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "EMAIL_IN_USE" });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      role: "USER"
    },
    select: { id: true, email: true, displayName: true, role: true, membershipExpiresAt: true }
  });
  req.session.userId = user.id;
  res.json({ user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  req.session.userId = user.id;
  const safe = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, email: true, displayName: true, role: true, membershipExpiresAt: true } });
  res.json({ user: safe });
});

authRouter.post("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie(env.SESSION_COOKIE_NAME);
    res.json({ ok: true });
  });
});
