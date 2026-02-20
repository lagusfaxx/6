import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAuth } from "../auth/middleware";
import { resolveProfessionalLevel } from "../lib/professionalLevel";

export const marketplaceRouter = Router();

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

marketplaceRouter.get(
  "/explore/results",
  asyncHandler(async (req, res) => {
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const radiusKm = req.query.radiusKm ? Number(req.query.radiusKm) : 4;
    const category =
      typeof req.query.category === "string" ? req.query.category : "";
    const featured = req.query.featured === "true";
    const isAvailableNow = req.query.isAvailableNow === "true";
    const planTier =
      typeof req.query.planTier === "string"
        ? req.query.planTier.toUpperCase()
        : "";
    const attributes = Array.isArray(req.query.attributes)
      ? req.query.attributes.map(String)
      : typeof req.query.attributes === "string"
        ? req.query.attributes
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : [];

    const users = await prisma.user.findMany({
      where: {
        profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
        isActive: true,
        moderationStatus: "APPROVED",
        ...(isAvailableNow ? { isAvailableNow: true } : {}),
        ...(planTier && ["SILVER", "GOLD", "PLATINUM"].includes(planTier)
          ? { planTier: planTier as any }
          : {}),
        ...(category
          ? {
              OR: [
                {
                  serviceCategory: { contains: category, mode: "insensitive" },
                },
                { category: { slug: category } },
              ],
            }
          : {}),
        ...(attributes.length
          ? {
              profileAttributes: {
                some: {
                  attribute: {
                    slug: { in: attributes },
                  },
                },
              },
            }
          : {}),
      },
      include: {
        profileAttributes: { include: { attribute: true } },
      },
      take: 300,
    });

    const result = users
      .map((u) => {
        const distanceKm =
          lat !== null &&
          lng !== null &&
          u.latitude !== null &&
          u.longitude !== null
            ? haversine(lat, lng, u.latitude, u.longitude)
            : null;
        return {
          id: u.id,
          username: u.username,
          displayName: u.displayName || u.username,
          avatarUrl: u.avatarUrl,
          coverUrl: u.coverUrl,
          serviceCategory: u.serviceCategory,
          city: u.city,
          latitude: u.latitude,
          longitude: u.longitude,
          distanceKm,
          isAvailableNow: u.isAvailableNow,
          planTier: u.planTier,
          featured: ["PLATINUM", "GOLD"].includes(u.planTier),
          userLevel: resolveProfessionalLevel(u.completedServices),
          attributes: u.profileAttributes.map((pa) => pa.attribute),
          profileType: u.profileType,
          isActive: u.isActive,
          lastSeen: u.lastSeen?.toISOString() || null,
        };
      })
      .filter((u) => (u.distanceKm != null ? u.distanceKm <= radiusKm : true));

    result.sort((a, b) => {
      const planRank = { PLATINUM: 3, GOLD: 2, SILVER: 1 } as Record<
        string,
        number
      >;
      if (planRank[b.planTier] !== planRank[a.planTier])
        return planRank[b.planTier] - planRank[a.planTier];
      if (Number(b.isAvailableNow) !== Number(a.isAvailableNow))
        return Number(b.isAvailableNow) - Number(a.isAvailableNow);
      return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
    });

    return res.json({
      profiles: featured ? result.filter((r) => r.featured) : result,
    });
  }),
);

marketplaceRouter.get(
  "/stories/active",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const stories = await prisma.story.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: now },
        profile: { isActive: true, moderationStatus: "APPROVED" },
      },
      include: {
        profile: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            planTier: true,
          },
        },
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return res.json({ stories });
  }),
);

marketplaceRouter.post(
  "/stories/:id/view",
  asyncHandler(async (req, res) => {
    const storyId = req.params.id;
    const viewerId = req.session.userId || null;
    await prisma.storyView.create({ data: { storyId, viewerId } });
    return res.json({ ok: true });
  }),
);

marketplaceRouter.post(
  "/stories",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId! },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });
    if (user.moderationStatus !== "APPROVED" || !user.isActive)
      return res.status(403).json({ error: "FORBIDDEN" });

    const { mediaUrl, mediaType, expiresAt } = req.body as {
      mediaUrl?: string;
      mediaType?: string;
      expiresAt?: string;
    };
    if (!mediaUrl || !mediaType || !expiresAt)
      return res.status(400).json({ error: "VALIDATION" });

    const activeCount = await prisma.story.count({
      where: {
        profileId: user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });
    if (activeCount >= 5) return res.status(400).json({ error: "STORY_LIMIT" });

    const story = await prisma.story.create({
      data: {
        profileId: user.id,
        mediaUrl,
        mediaType: mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
        expiresAt: new Date(expiresAt),
      },
    });
    return res.json({ story });
  }),
);

marketplaceRouter.post(
  "/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { profileId, rating, comment } = req.body as {
      profileId?: string;
      rating?: number;
      comment?: string;
    };
    if (!profileId || !rating || !comment)
      return res.status(400).json({ error: "VALIDATION" });

    const author = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { profileType: true },
    });
    if (!author || author.profileType !== "CLIENT")
      return res.status(403).json({ error: "ONLY_CLIENT" });

    const review = await prisma.review.upsert({
      where: {
        authorId_profileId: { authorId: req.session.userId!, profileId },
      },
      update: { rating: Math.max(1, Math.min(5, rating)), comment },
      create: {
        authorId: req.session.userId!,
        profileId,
        rating: Math.max(1, Math.min(5, rating)),
        comment,
      },
    });

    return res.json({ review });
  }),
);

marketplaceRouter.get(
  "/profiles/:id/reviews/summary",
  asyncHandler(async (req, res) => {
    const profileId = req.params.id;
    const summary = await prisma.review.aggregate({
      where: { profileId, status: "VISIBLE" },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return res.json({
      average: summary._avg.rating ? Number(summary._avg.rating.toFixed(2)) : 0,
      total: summary._count._all,
    });
  }),
);

marketplaceRouter.get(
  "/profiles/:id/reviews",
  requireAuth,
  asyncHandler(async (req, res) => {
    const profileId = req.params.id;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(20, Math.max(5, Number(req.query.limit || 10)));
    const reviews = await prisma.review.findMany({
      where: { profileId, status: "VISIBLE" },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    return res.json({ reviews, page, limit });
  }),
);
