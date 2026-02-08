import { Router } from "express";
import argon2 from "argon2";
import { prisma } from "../db";
import { loginInputSchema, registerInputSchema } from "@uzeed/shared";
import { asyncHandler } from "../lib/asyncHandler";

export const authRouter = Router();

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function normalizeProfileType(input: string) {
  const value = input.trim().toUpperCase();
  if (value.includes("MOTEL") || value.includes("NIGHT") || value.includes("ESTABLEC")) return "ESTABLISHMENT";
  if (value.includes("TIENDA") || value.includes("SHOP") || value.includes("SEX")) return "SHOP";
  if (value.includes("PROFESIONAL") || value.includes("EXPERIENCIA")) return "PROFESSIONAL";
  if (value.includes("CLIENT")) return "CLIENT";
  return value;
}

authRouter.post("/register", asyncHandler(async (req, res) => {
  const payload = { ...req.body } as Record<string, any>;
  if (typeof payload.profileType === "string") {
    payload.profileType = normalizeProfileType(payload.profileType);
  }
  const parsed = registerInputSchema.safeParse(payload);
  if (!parsed.success) {
    const profileTypeIssue = parsed.error.issues.find((issue) => issue.path.includes("profileType"));
    if (profileTypeIssue) {
      console.error("[auth/register] invalid profileType", {
        profileType: payload.profileType,
        email: payload.email,
        username: payload.username
      });
      return res.status(400).json({ error: "PROFILE_TYPE_INVALID", message: "Tipo de perfil inválido. Actualiza la página e intenta nuevamente." });
    }
    return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });
  }

  const { email, password, displayName, username, phone, gender, profileType, preferenceGender, address, birthdate, bio } = parsed.data;
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (existing?.email === email) return res.status(409).json({ error: "EMAIL_IN_USE" });
  if (existing?.username === username) return res.status(409).json({ error: "USERNAME_IN_USE" });

  const passwordHash = await argon2.hash(password);
  const shopTrialEndsAt = profileType === "SHOP" ? addDays(new Date(), 30) : null;
  let safeBirthdate: Date | null = null;
  if (birthdate) {
    const parsedBirthdate = new Date(birthdate);
    if (Number.isNaN(parsedBirthdate.getTime())) {
      return res.status(400).json({ error: "BIRTHDATE_INVALID", message: "La fecha de nacimiento no es válida." });
    }
    const now = new Date();
    let age = now.getFullYear() - parsedBirthdate.getFullYear();
    const m = now.getMonth() - parsedBirthdate.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < parsedBirthdate.getDate())) {
      age -= 1;
    }
    if (age < 18) {
      return res.status(400).json({ error: "BIRTHDATE_UNDERAGE", message: "Debes ser mayor de 18 años." });
    }
    safeBirthdate = parsedBirthdate;
  }
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email,
        username,
        phone,
        gender: gender || null,
        preferenceGender: preferenceGender || null,
        profileType,
        address,
        termsAcceptedAt: new Date(),
        membershipExpiresAt: profileType === "CLIENT" ? null : addDays(new Date(), 30),
        passwordHash,
        displayName: displayName || null,
        bio: bio || null,
        birthdate: safeBirthdate,
        shopTrialEndsAt,
        subscriptionPrice: profileType === "CREATOR" || profileType === "PROFESSIONAL" ? 2500 : null,
        role: "USER"
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        membershipExpiresAt: true,
        username: true,
        profileType: true,
        gender: true,
        preferenceGender: true
      }
    });
  } catch (err) {
    console.error("[auth/register] create failed", { email, username, profileType, error: err });
    throw err;
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  return res.json({
    user: { ...user, membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null }
  });
}));

authRouter.post("/login", asyncHandler(async (req, res) => {
  const parsed = loginInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  const ok = await argon2.verify(user.passwordHash, password);
  if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

  req.session.userId = user.id;
  req.session.role = user.role;

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      username: user.username,
      profileType: user.profileType,
      gender: user.gender,
      preferenceGender: user.preferenceGender,
      role: user.role,
      membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null
    }
  });
}));

authRouter.post("/logout", asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "LOGOUT_FAILED" });
    res.clearCookie("uzeed_session");
    return res.json({ ok: true });
  });
}));

authRouter.get("/me", asyncHandler(async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      membershipExpiresAt: true,
      username: true,
      profileType: true,
      gender: true,
      preferenceGender: true,
      avatarUrl: true,
      address: true,
      phone: true,
      bio: true,
      coverUrl: true,
      subscriptionPrice: true,
      serviceCategory: true,
      serviceDescription: true,
      city: true,
      latitude: true,
      longitude: true,
      allowFreeMessages: true,
      birthdate: true
    }
  });
  if (!user) return res.json({ user: null });
  return res.json({
    user: { ...user, membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null }
  });
}));
