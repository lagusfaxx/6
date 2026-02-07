import { Router } from "express";
import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { asyncHandler } from "../lib/asyncHandler";
import { findCategoryByRef } from "../lib/categories";
import { obfuscateLocation } from "../lib/locationPrivacy";

export const directoryRouter = Router();

function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function isOnline(lastSeen: Date | null) {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= 1000 * 60 * 7;
}

function categoryMatches(categoryName: string, profileCategory?: string | null, services?: string[]) {
  const normalized = (categoryName || "").toLowerCase();
  if (!normalized) return false;
  if ((profileCategory || "").toLowerCase().includes(normalized)) return true;
  if ((services || []).some((c) => (c || "").toLowerCase().includes(normalized))) return true;
  return false;
}

function calculateAge(birthdate: Date | null) {
  if (!birthdate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function ageFromLegacyBio(bio?: string | null) {
  const m = (bio || "").match(/^\[edad:(\d{1,2})\]/i);
  if (!m) return null;
  const age = Number(m[1]);
  return Number.isFinite(age) ? age : null;
}

function resolveAge(birthdate: Date | null, bio?: string | null) {
  const fromBirthdate = calculateAge(birthdate);
  if (fromBirthdate != null) return fromBirthdate;
  return ageFromLegacyBio(bio);
}

function parseRangeKm(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(200, parsed));
}

// ✅ Profesionales
directoryRouter.get("/professionals", asyncHandler(async (req, res) => {
  const now = new Date();
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const categorySlug = typeof req.query.categorySlug === "string" ? req.query.categorySlug : typeof req.query.category === "string" ? req.query.category : "";
  const rangeKm = parseRangeKm(req.query.rangeKm, 15);
  const gender = typeof req.query.gender === "string" ? req.query.gender : "";
  const tier = typeof req.query.tier === "string" ? req.query.tier : "";
  const minRating = req.query.minRating ? Number(req.query.minRating) : null;

  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const where: any = {
    profileType: "PROFESSIONAL",
    isActive: true,
    OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }]
  };

  let categoryRef = null;
  if (categoryId || categorySlug) {
    try {
      categoryRef = await findCategoryByRef(prisma, {
        categoryId: categoryId || null,
        categorySlug: categorySlug || null,
        kind: "PROFESSIONAL"
      });
    } catch (error) {
      console.error("[directory/professionals] category lookup failed", {
        requestId: (req as any).requestId,
        route: req.originalUrl,
        categoryId,
        categorySlug,
        message: (error as Error)?.message
      });
      return res.json({
        professionals: [],
        category: null,
        warning: "category_lookup_failed",
        message: "No se pudo resolver la categoría seleccionada."
      });
    }
    if (!categoryRef) {
      return res.json({
        professionals: [],
        category: null,
        warning: "category_not_found",
        message: "La categoría seleccionada no existe."
      });
    }
    where.services = { some: { categoryId: categoryRef.id, isActive: true } };
  } else {
    where.services = { some: { isActive: true } };
  }

  if (gender) where.gender = gender;
  if (tier) where.tier = tier;

  let users: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
    lastSeen: Date | null;
    isActive: boolean;
    tier: string | null;
    gender: string | null;
    bio: string | null;
    birthdate: Date | null;
    serviceCategory: string | null;
    serviceDescription: string | null;
    services: Array<{
      category: string | null;
      categoryId: string | null;
      latitude: number | null;
      longitude: number | null;
      locality?: string | null;
      approxAreaM?: number | null;
    }>;
    category: { id: string; name: string; displayName: string | null; slug: string; kind: string } | null;
  }> = [];
  try {
    users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        lastSeen: true,
        isActive: true,
        tier: true,
        gender: true,
        bio: true,
        birthdate: true,
        serviceCategory: true,
        serviceDescription: true,
        services: {
          where: { isActive: true },
          select: { category: true, categoryId: true, latitude: true, longitude: true, locality: true, approxAreaM: true },
          take: 25,
          orderBy: { createdAt: "desc" }
        },
        category: { select: { id: true, name: true, displayName: true, slug: true, kind: true } }
      },
      take: 250
    });
  } catch (error) {
    if (
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") ||
      error instanceof Prisma.PrismaClientValidationError
    ) {
      users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          coverUrl: true,
          lastSeen: true,
          isActive: true,
          tier: true,
          gender: true,
          bio: true,
          birthdate: true,
          serviceCategory: true,
          serviceDescription: true,
          services: {
            where: { isActive: true },
            select: { category: true, categoryId: true, latitude: true, longitude: true },
            take: 25,
            orderBy: { createdAt: "desc" }
          },
          category: { select: { id: true, name: true, displayName: true, slug: true, kind: true } }
        },
        take: 250
      });
    } else {
      throw error;
    }
  }

  // rating promedio por professional via service requests join
  const ratingByProfessional = new Map<string, number>();
  const counts = new Map<string, number>();
  const reviews = await prisma.professionalReview.findMany({
    select: { hearts: true, serviceRequest: { select: { professionalId: true } } }
  });
  for (const r of reviews) {
    const pid = r.serviceRequest.professionalId;
    ratingByProfessional.set(pid, (ratingByProfessional.get(pid) || 0) + r.hearts);
    counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  const mapped = users.map((u) => {
    const activeService = u.services[0];
    const avg = counts.get(u.id) ? (ratingByProfessional.get(u.id)! / counts.get(u.id)!) : null;
    const distance =
      lat != null && lng != null && activeService?.latitude != null && activeService?.longitude != null
        ? haversineKm(lat, lng, activeService.latitude, activeService.longitude)
        : null;
    const areaRadius = activeService?.approxAreaM ?? 600;
    const obfuscated = obfuscateLocation(activeService?.latitude, activeService?.longitude, `professional:${u.id}`, areaRadius);

    return {
      id: u.id,
      name: u.displayName || u.username,
      avatarUrl: u.avatarUrl,
      rating: avg ? Number(avg.toFixed(2)) : null,
      distance,
      latitude: obfuscated.latitude,
      longitude: obfuscated.longitude,
      locality: activeService?.locality || u.city || null,
      approxAreaM: areaRadius,
      isActive: u.isActive,
      tier: u.tier,
      gender: u.gender,
      age: resolveAge(u.birthdate, u.bio),
      serviceSummary: u.serviceDescription || u.serviceCategory || null,
      primaryPhoto: u.avatarUrl,
      profile: {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        coverUrl: u.coverUrl || null
      },
      category: u.category,
      serviceCategory: u.serviceCategory,
      serviceItemCategories: u.services.map((sv) => sv.category || ""),
      serviceItemCategoryIds: u.services.map((sv) => sv.categoryId || "").filter(Boolean),
      isOnline: isOnline(u.lastSeen),
      lastSeen: u.lastSeen ? u.lastSeen.toISOString() : null
    };
  });

  const filtered = mapped
    .filter((u) => {
      if (!categoryId && !categorySlug) return true;
      if (categoryRef?.id && u.category?.id === categoryRef.id) return true;
      if (categoryRef?.id && u.serviceItemCategoryIds.includes(categoryRef.id)) return true;
      if (!categoryRef?.displayName && !categoryRef?.name) return false;
      return categoryMatches(categoryRef.displayName || categoryRef.name, u.serviceCategory, u.serviceItemCategories || []);
    })
    .filter((u) => (lat != null && lng != null && u.distance != null ? u.distance <= rangeKm : true))
    .filter((u) => (minRating != null && u.rating != null ? u.rating >= minRating : true))
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({
    professionals: filtered,
    category: categoryRef ? { id: categoryRef.id, name: categoryRef.name, displayName: categoryRef.displayName, slug: categoryRef.slug } : null
  });
}));

directoryRouter.get("/professionals/recent", asyncHandler(async (req, res) => {
  const now = new Date();
  const limit = Math.max(1, Math.min(12, Number(req.query.limit || 6)));
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const users = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }],
      services: { some: { isActive: true } }
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      birthdate: true,
      createdAt: true,
      services: {
        where: { isActive: true },
        select: { latitude: true, longitude: true },
        take: 1,
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const mapped = users.map((u) => {
    const activeService = u.services[0];
    const distance =
      lat != null && lng != null && activeService?.latitude != null && activeService?.longitude != null
        ? haversineKm(lat, lng, activeService.latitude, activeService.longitude)
        : null;
    return {
      id: u.id,
      name: u.displayName || u.username,
      avatarUrl: u.avatarUrl,
      distance,
      age: resolveAge(u.birthdate, u.bio)
    };
  });

  return res.json({ professionals: mapped });
}));

directoryRouter.get("/professionals/:id", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      city: true,
      gender: true,
      birthdate: true,
      isActive: true,
      lastSeen: true,
      serviceCategory: true,
      serviceDescription: true,
      services: {
        where: { isActive: true },
        select: { category: true, categoryId: true, latitude: true, longitude: true, locality: true, approxAreaM: true },
        take: 1,
        orderBy: { createdAt: "desc" }
      },
      category: { select: { id: true, name: true, displayName: true, slug: true, kind: true } }
    }
  });

  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  const activeService = user.services[0];
  const areaRadius = activeService?.approxAreaM ?? 600;
  const obfuscated = obfuscateLocation(activeService?.latitude, activeService?.longitude, `professional:${user.id}`, areaRadius);

  return res.json({
    id: user.id,
    name: user.displayName || user.username,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl || null,
    bio: user.bio,
    city: user.city,
    gender: user.gender,
    age: resolveAge(user.birthdate, user.bio),
    latitude: obfuscated.latitude,
    longitude: obfuscated.longitude,
    locality: activeService?.locality || user.city || null,
    approxAreaM: areaRadius,
    isActive: user.isActive,
    serviceDescription: user.serviceDescription,
    serviceCategory: user.serviceCategory,
    category: user.category,
    isOnline: isOnline(user.lastSeen),
    lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null
  });
}));
