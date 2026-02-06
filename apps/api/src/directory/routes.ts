import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

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
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOnline(lastSeen: Date | null) {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() < 5 * 60 * 1000;
}

function normalizeCategoryText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const categoryAliases: Record<string, string[]> = {
  motel: ["moteles", "centros privados", "centrosprivados"],
  moteles: ["motel", "centros privados", "centrosprivados"],
  centrosprivados: ["centros privados", "motel", "moteles"],
  spas: ["spa", "cafe", "cafes"],
  spa: ["spas", "cafe", "cafes"],
  cafe: ["cafes", "spa", "spas"],
  cafes: ["cafe", "spa", "spas"],
  acompanamiento: ["acompanantes", "acompanante", "acompañamiento"],
  acompanantes: ["acompanamiento", "acompanante", "acompañantes"],
  masaje: ["masajes"],
  masajes: ["masaje"]
};

function categoryVariants(value: string | null | undefined) {
  const normalized = normalizeCategoryText(value).replace(/\s+/g, "");
  if (!normalized) return [] as string[];
  const aliases = (categoryAliases[normalized] || []).map((a) => normalizeCategoryText(a).replace(/\s+/g, ""));
  return Array.from(new Set([normalized, ...aliases]));
}

function categoryMatches(categoryName: string | null | undefined, profileCategory: string | null | undefined, itemCategories: string[]) {
  const targetVariants = categoryVariants(categoryName);
  if (!targetVariants.length) return false;

  const values = [profileCategory, ...itemCategories].map((v) => categoryVariants(v));

  return values.some((variants) =>
    variants.some((candidate) =>
      targetVariants.some((target) =>
        candidate === target || candidate.includes(target) || target.includes(candidate)
      )
    )
  );
}

// ✅ Profesionales
directoryRouter.get("/professionals", asyncHandler(async (req, res) => {
  const now = new Date();
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 15)));
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
  const categoryRef = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } })
    : null;
  if (gender) where.gender = gender;
  if (tier) where.tier = tier;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      latitude: true,
      longitude: true,
      lastSeenAt: true,
      isActive: true,
      tier: true,
      gender: true,
      serviceCategory: true,
      services: { select: { category: true }, take: 25, orderBy: { createdAt: "desc" } },
      category: { select: { id: true, name: true, kind: true } }
    },
    take: 250
  });

  const ratings = await prisma.professionalReview.groupBy({
    by: ["serviceRequestId"],
    _avg: { hearts: true }
  }).catch(() => []);

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
    const avg = counts.get(u.id) ? (ratingByProfessional.get(u.id)! / counts.get(u.id)!) : null;
    const distance =
      lat != null && lng != null && u.latitude != null && u.longitude != null
        ? haversineKm(lat, lng, u.latitude, u.longitude)
        : null;

    return {
      id: u.id,
      name: u.displayName || u.username,
      avatarUrl: u.avatarUrl,
      rating: avg ? Number(avg.toFixed(2)) : null,
      distance,
      latitude: u.latitude,
      longitude: u.longitude,
      isActive: u.isActive,
      tier: u.tier,
      gender: u.gender,
      category: u.category,
      serviceCategory: u.serviceCategory,
      serviceItemCategories: u.services.map((sv) => sv.category || ""),
      isOnline: isOnline(u.lastSeenAt),
      lastSeen: u.lastSeenAt ? u.lastSeenAt.toISOString() : null
    };
  });

  const filtered = mapped
    .filter((u) => {
      if (!categoryId) return true;
      if (u.category?.id === categoryId) return true;
      if (!categoryRef?.name) return false;
      return categoryMatches(categoryRef.name, u.serviceCategory, u.serviceItemCategories || []);
    })
    .filter((u) => (lat != null && lng != null && u.distance != null ? u.distance <= rangeKm : true))
    .filter((u) => (minRating != null && u.rating != null ? u.rating >= minRating : true))
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({ professionals: filtered });
}));

directoryRouter.get("/professionals/:id", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      isActive: true,
      lastSeenAt: true,
      bio: true,
      category: { select: { id: true, name: true, kind: true } },
      media: { where: { type: "IMAGE" }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, url: true, type: true } }
    }
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });

  const reviews = await prisma.professionalReview.findMany({
    where: { serviceRequest: { professionalId: id } },
    select: { hearts: true }
  });
  const rating = reviews.length ? reviews.reduce((a, r) => a + r.hearts, 0) / reviews.length : null;

  return res.json({
    professional: {
      id: u.id,
      name: u.displayName || u.username,
      avatarUrl: u.avatarUrl,
      category: u.category?.name || null,
      isActive: u.isActive,
      rating: rating ? Number(rating.toFixed(2)) : null,
      description: u.bio,
      isOnline: isOnline(u.lastSeenAt),
      lastSeen: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
      gallery: u.media
    }
  });
}));

// ✅ Establecimientos
directoryRouter.get("/establishments", asyncHandler(async (req, res) => {
  const now = new Date();
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 20)));
  const minRating = req.query.minRating ? Number(req.query.minRating) : null;

  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const where: any = {
    profileType: "ESTABLISHMENT",
    isActive: true,
    OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }]
  };
  const categoryRef = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId }, select: { name: true } })
    : null;

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      city: true,
      address: true,
      phone: true,
      bio: true,
      latitude: true,
      longitude: true,
      media: { where: { type: "IMAGE" }, orderBy: { createdAt: "desc" }, take: 6, select: { url: true } },
      serviceCategory: true,
      services: { select: { category: true }, take: 25, orderBy: { createdAt: "desc" } },
      category: { select: { id: true, name: true } }
    },
    take: 250
  });

  const reviews = await prisma.establishmentReview.findMany({
    select: { stars: true, establishmentId: true }
  });

  const sum = new Map<string, number>();
  const cnt = new Map<string, number>();
  for (const r of reviews) {
    sum.set(r.establishmentId, (sum.get(r.establishmentId) || 0) + r.stars);
    cnt.set(r.establishmentId, (cnt.get(r.establishmentId) || 0) + 1);
  }

  const mapped = users.map((u) => {
    const rating = cnt.get(u.id) ? sum.get(u.id)! / cnt.get(u.id)! : null;
    const distance =
      lat != null && lng != null && u.latitude != null && u.longitude != null
        ? haversineKm(lat, lng, u.latitude, u.longitude)
        : null;

    return {
      id: u.id,
      name: u.displayName || u.username,
      city: u.city,
      address: u.address,
      phone: u.phone,
      description: u.bio,
      rating: rating ? Number(rating.toFixed(2)) : null,
      distance,
      latitude: u.latitude,
      longitude: u.longitude,
      gallery: u.media.map((m) => m.url),
      category: u.category,
      serviceCategory: u.serviceCategory,
      serviceItemCategories: u.services.map((sv) => sv.category || "")
    };
  });

  const filtered = mapped
    .filter((u) => {
      if (!categoryId) return true;
      if (u.category?.id === categoryId) return true;
      if (!categoryRef?.name) return false;
      return categoryMatches(categoryRef.name, u.serviceCategory, u.serviceItemCategories || []);
    })
    .filter((u) => (lat != null && lng != null && u.distance != null ? u.distance <= rangeKm : true))
    .filter((u) => (minRating != null && u.rating != null ? u.rating >= minRating : true))
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({ establishments: filtered });
}));

directoryRouter.get("/establishments/:id", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      displayName: true,
      city: true,
      address: true,
      phone: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      media: { where: { type: "IMAGE" }, orderBy: { createdAt: "desc" }, take: 12, select: { url: true } },
      motelRooms: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
      motelPacks: { where: { isActive: true }, orderBy: { createdAt: "desc" } },
      motelPromotions: { where: { isActive: true }, orderBy: { createdAt: "desc" } }
    }
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });

  const reviews = await prisma.establishmentReview.findMany({ where: { establishmentId: id }, select: { stars: true } });
  const rating = reviews.length ? reviews.reduce((a, r) => a + r.stars, 0) / reviews.length : null;

  return res.json({
    establishment: {
      id: u.id,
      name: u.displayName || u.username,
      city: u.city,
      address: u.address,
      phone: u.phone,
      description: u.bio,
      avatarUrl: u.avatarUrl,
      coverUrl: u.coverUrl,
      gallery: u.media.map((m) => m.url),
      rating: rating ? Number(rating.toFixed(2)) : null,
      rooms: u.motelRooms,
      packs: u.motelPacks,
      promotions: u.motelPromotions
    }
  });
}));
