import { Router } from "express";
import argon2 from "argon2";
import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { loginInputSchema, registerInputSchema } from "@uzeed/shared";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";

export const authRouter = Router();

function persistSession(req: any): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err: unknown) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function normalizeProfileType(input: string) {
  const value = input.trim().toUpperCase();
  if (
    value.includes("MOTEL") ||
    value.includes("HOTEL") ||
    value.includes("NIGHT") ||
    value.includes("ESTABLEC")
  )
    return "ESTABLISHMENT";
  if (
    value.includes("TIENDA") ||
    value.includes("SHOP") ||
    value.includes("SEX")
  )
    return "SHOP";
  if (value.includes("PROFESIONAL") || value.includes("EXPERIENCIA"))
    return "PROFESSIONAL";
  if (value.includes("CLIENT")) return "CLIENT";
  return value;
}

async function geocodeAddress(address: string) {
  const token =
    process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !address.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1&language=es`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    const first = payload?.features?.[0];
    if (!first?.center || first.center.length < 2) return null;
    const city = Array.isArray(first.context)
      ? String(
          first.context.find((c: any) =>
            String(c.id || "").startsWith("place."),
          )?.text || "",
        ).trim() || null
      : null;
    return {
      longitude: Number(first.center[0]),
      latitude: Number(first.center[1]),
      city,
    };
  } catch {
    return null;
  }
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const payload = { ...req.body } as Record<string, any>;
    if (typeof payload.profileType === "string") {
      payload.profileType = normalizeProfileType(payload.profileType);
    }
    const parsed = registerInputSchema.safeParse(payload);
    if (!parsed.success) {
      const profileTypeIssue = parsed.error.issues.find((issue) =>
        issue.path.includes("profileType"),
      );
      if (profileTypeIssue) {
        console.error("[auth/register] invalid profileType", {
          profileType: payload.profileType,
          email: payload.email,
          username: payload.username,
        });
        return res
          .status(400)
          .json({
            error: "PROFILE_TYPE_INVALID",
            message:
              "Tipo de perfil inválido. Actualiza la página e intenta nuevamente.",
          });
      }
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });
    }

    const {
      email,
      password,
      displayName,
      username,
      phone,
      gender,
      profileType,
      preferenceGender,
      address,
      city,
      latitude,
      longitude,
      birthdate,
      bio,
    } = parsed.data;
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing?.email === email)
      return res.status(409).json({ error: "EMAIL_IN_USE" });
    if (existing?.username === username)
      return res.status(409).json({ error: "USERNAME_IN_USE" });

    const passwordHash = await argon2.hash(password);

    // Determine trial period: 7 days for business profiles, 30 days for others
    const requiresPayment = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(
      profileType,
    );
    const trialDays = requiresPayment ? config.freeTrialDays : 30;
    const shopTrialEndsAt =
      profileType === "SHOP" ? addDays(new Date(), trialDays) : null;

    const isBusinessProfile = [
      "PROFESSIONAL",
      "ESTABLISHMENT",
      "SHOP",
    ].includes(profileType);
    const geocoded = isBusinessProfile
      ? await geocodeAddress(address || "")
      : null;
    let safeBirthdate: Date | null = null;
    if (birthdate) {
      const parsedBirthdate = new Date(birthdate);
      if (Number.isNaN(parsedBirthdate.getTime())) {
        return res
          .status(400)
          .json({
            error: "BIRTHDATE_INVALID",
            message: "La fecha de nacimiento no es válida.",
          });
      }
      const now = new Date();
      let age = now.getFullYear() - parsedBirthdate.getFullYear();
      const m = now.getMonth() - parsedBirthdate.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < parsedBirthdate.getDate())) {
        age -= 1;
      }
      if (age < 18) {
        return res
          .status(400)
          .json({
            error: "BIRTHDATE_UNDERAGE",
            message: "Debes ser mayor de 18 años.",
          });
      }
      safeBirthdate = parsedBirthdate;
    }
    if (isBusinessProfile) {
      const hasCoordsFromClient =
        Number.isFinite(latitude) && Number.isFinite(longitude);
      const hasCoordsFromGeocode =
        Number.isFinite(geocoded?.latitude) &&
        Number.isFinite(geocoded?.longitude);
      if (!hasCoordsFromClient && !hasCoordsFromGeocode) {
        return res.status(400).json({
          error: "ADDRESS_NOT_VERIFIED",
          message:
            "Debes validar la dirección con Mapbox para publicar tu perfil.",
        });
      }
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
          address: address || null,
          city: city || geocoded?.city || null,
          latitude: isBusinessProfile
            ? Number(latitude ?? geocoded?.latitude)
            : null,
          longitude: isBusinessProfile
            ? Number(longitude ?? geocoded?.longitude)
            : null,
          termsAcceptedAt: new Date(),
          membershipExpiresAt:
            profileType === "CLIENT" || profileType === "VIEWER"
              ? null
              : addDays(new Date(), trialDays),
          passwordHash,
          displayName: displayName || null,
          bio: bio || null,
          birthdate: safeBirthdate,
          shopTrialEndsAt,
          subscriptionPrice:
            profileType === "CREATOR" || profileType === "PROFESSIONAL"
              ? 2500
              : null,
          isOnline: true,
          lastSeen: new Date(),
          role: "USER",
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
          preferenceGender: true,
        },
      });
    } catch (err) {
      console.error("[auth/register] create failed", {
        email,
        username,
        profileType,
        error: err,
      });
      throw err;
    }

    req.session.userId = user.id;
    req.session.role = user.role;
    await persistSession(req);
    return res.json({
      user: {
        ...user,
        membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null,
      },
    });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginInputSchema.safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });

    const { email, password } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) return res.status(401).json({ error: "INVALID_CREDENTIALS" });

    req.session.userId = user.id;
    req.session.role = user.role;
    await persistSession(req);

    await prisma.user.update({
      where: { id: user.id },
      data: { isOnline: true, lastSeen: new Date() },
    });

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
        membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null,
      },
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "LOGOUT_FAILED" });
      res.clearCookie("uzeed_session");
      return res.json({ ok: true });
    });
    if (userId) {
      await prisma.user
        .update({
          where: { id: userId },
          data: { isOnline: false },
        })
        .catch(() => undefined);
    }
  }),
);

authRouter.post(
  "/ping",
  asyncHandler(async (req, res) => {
    if (!req.session.userId)
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    const now = new Date();
    await prisma.user.update({
      where: { id: req.session.userId },
      data: {
        isOnline: true,
        lastSeen: now,
      },
    });
    return res.json({ ok: true, lastSeen: now.toISOString() });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.session.userId)
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    const baseSelect = {
      id: true, email: true, displayName: true, role: true,
      membershipExpiresAt: true, shopTrialEndsAt: true, createdAt: true,
      username: true, profileType: true, gender: true,
      preferenceGender: true, avatarUrl: true, address: true,
      phone: true, bio: true, coverUrl: true, subscriptionPrice: true,
      serviceCategory: true, serviceDescription: true, heightCm: true,
      weightKg: true, measurements: true, hairColor: true,
      skinTone: true, languages: true, serviceStyleTags: true,
      availabilityNote: true, baseRate: true, minDurationMinutes: true,
      acceptsIncalls: true, acceptsOutcalls: true, city: true,
      latitude: true, longitude: true, allowFreeMessages: true,
      birthdate: true,
    };
    const extendedSelect = {
      ...baseSelect,
      primaryCategory: true,
      profileTags: true,
      serviceTags: true,
    };
    let user: any;
    try {
      user = await prisma.user.findUnique({
        where: { id: req.session.userId },
        select: extendedSelect,
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientValidationError
      ) {
        // New columns not yet in DB — fallback
        user = await prisma.user.findUnique({
          where: { id: req.session.userId },
          select: baseSelect,
        });
        if (user) {
          user.primaryCategory = null;
          user.profileTags = [];
          user.serviceTags = [];
        }
      } else {
        throw err;
      }
    }
    if (!user) return res.json({ user: null });

    // Add subscription status info
    const requiresPayment = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(
      user.profileType,
    );
    const now = new Date();
    const membershipActive = user.membershipExpiresAt
      ? user.membershipExpiresAt.getTime() > now.getTime()
      : false;
    const trialActive = user.shopTrialEndsAt
      ? user.shopTrialEndsAt.getTime() > now.getTime()
      : false;
    const subscriptionActive = requiresPayment
      ? membershipActive || trialActive
      : true;

    return res.json({
      user: {
        ...user,
        membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null,
        shopTrialEndsAt: user.shopTrialEndsAt?.toISOString() || null,
        subscriptionActive,
        requiresPayment,
      },
    });
  }),
);
