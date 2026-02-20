import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { isBusinessPlanActive } from "../lib/subscriptions";
import { computeVipRankingScore, type RankingInput } from "../lib/ranking";
import {
  resolveProfessionalLevel,
} from "../lib/professionalLevel";
import { obfuscateLocation } from "../lib/locationPrivacy";

export const homeRouter = Router();

/* ── helpers ───────────────────────────────────────────── */

const AVAILABLE_WINDOW_MS = 5 * 60 * 1000;

function computeAvailableNow(lastSeen: Date | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - lastSeen.getTime() <= AVAILABLE_WINDOW_MS;
}

function computeAge(birthdate: Date | null | undefined) {
  if (!birthdate) return null;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age -= 1;
  return age >= 18 ? age : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── in-memory cache for summary ──────────────────────── */

type SummaryCache = {
  data: Record<string, unknown>;
  expiresAt: number;
};
const summaryCache = new Map<string, SummaryCache>();
const SUMMARY_TTL_MS = 60_000; // 60 seconds

/* ── shared query for professionals ───────────────────── */

const PROFILE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  coverUrl: true,
  birthdate: true,
  latitude: true,
  longitude: true,
  lastSeen: true,
  isActive: true,
  isOnline: true,
  completedServices: true,
  profileViews: true,
  tier: true,
  city: true,
  regionName: true,
  createdAt: true,
  membershipExpiresAt: true,
  shopTrialEndsAt: true,
  profileType: true,
  bio: true,
} as const;

type ProfileRow = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  birthdate: Date | null;
  latitude: number | null;
  longitude: number | null;
  lastSeen: Date | null;
  isActive: boolean;
  isOnline: boolean;
  completedServices: number;
  profileViews: number;
  tier: string | null;
  city: string | null;
  regionName: string | null;
  createdAt: Date;
  membershipExpiresAt: Date | null;
  shopTrialEndsAt: Date | null;
  profileType: string;
  bio: string | null;
};

function enrichProfile(
  p: ProfileRow,
  lat: number | null,
  lng: number | null,
) {
  const distanceKm =
    lat !== null && lng !== null && p.latitude !== null && p.longitude !== null
      ? haversineKm(lat, lng, p.latitude, p.longitude)
      : null;
  const availableNow = Boolean(p.isOnline) && computeAvailableNow(p.lastSeen);
  const userLevel = resolveProfessionalLevel(p.completedServices);
  const obfuscated = obfuscateLocation(
    p.latitude,
    p.longitude,
    `professional:${p.id}`,
    600,
  );

  return {
    id: p.id,
    username: p.username,
    displayName: p.displayName || p.username,
    age: computeAge(p.birthdate),
    avatarUrl: p.avatarUrl,
    coverUrl: p.coverUrl,
    lat: obfuscated.latitude,
    lng: obfuscated.longitude,
    distanceKm,
    availableNow,
    isActive: p.isActive,
    userLevel,
    tier: p.tier,
    completedServices: p.completedServices,
    profileViews: p.profileViews,
    lastActiveAt: p.lastSeen ? p.lastSeen.toISOString() : null,
    city: p.city,
    zone: p.city,
    createdAt: p.createdAt.toISOString(),
  };
}

/* ── GET /home/summary ────────────────────────────────── */

homeRouter.get(
  "/home/summary",
  asyncHandler(async (req, res) => {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const cacheKey = `summary:${city.toLowerCase()}`;
    const cached = summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.data);
    }

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const baseWhere: Record<string, unknown> = {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "CREATOR"] },
      isActive: true,
      OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }],
    };
    if (city) {
      (baseWhere as any).city = { equals: city, mode: "insensitive" };
    }

    const [totalInCity, platinumCount, newThisWeek, availableNowUsers] =
      await Promise.all([
        prisma.user.count({ where: baseWhere as any }),
        prisma.user.count({
          where: { ...baseWhere, tier: "PLATINUM" } as any,
        }),
        prisma.user.count({
          where: { ...baseWhere, createdAt: { gte: oneWeekAgo } } as any,
        }),
        prisma.user.count({
          where: {
            ...baseWhere,
            isOnline: true,
            lastSeen: { gte: new Date(now.getTime() - AVAILABLE_WINDOW_MS) },
          } as any,
        }),
      ]);

    const data = {
      city: city || "all",
      availableNowCount: availableNowUsers,
      newThisWeekCount: newThisWeek,
      platinumCount,
      totalInCityCount: totalInCity,
    };

    summaryCache.set(cacheKey, { data, expiresAt: Date.now() + SUMMARY_TTL_MS });
    return res.json(data);
  }),
);

/* ── GET /home/sections ───────────────────────────────── */

homeRouter.get(
  "/home/sections",
  asyncHandler(async (req, res) => {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const lat = req.query.lat != null ? Number(req.query.lat) : null;
    const lng = req.query.lng != null ? Number(req.query.lng) : null;
    const limitParam = req.query.limit != null ? Number(req.query.limit) : 12;
    const limit = Math.min(Math.max(1, limitParam), 24);

    const now = new Date();
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const baseWhere: Record<string, unknown> = {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "CREATOR"] },
      isActive: true,
      OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }],
    };
    if (city) {
      (baseWhere as any).city = { equals: city, mode: "insensitive" };
    }

    // Fetch all profiles for this city (capped at 500)
    const profiles = await prisma.user.findMany({
      where: baseWhere as any,
      select: PROFILE_SELECT,
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const enriched = profiles
      .filter((p) => isBusinessPlanActive(p))
      .map((p) => enrichProfile(p as ProfileRow, lat, lng));

    // strip internal fields for response
    const strip = (item: ReturnType<typeof enrichProfile>) => {
      const { createdAt: _c, ...rest } = item;
      return rest;
    };

    // Section 1: Platinum — tier = PLATINUM, sorted by VIP ranking
    const platinum = enriched
      .filter(
        (p) =>
          p.tier === "PLATINUM" || p.tier === "PREMIUM",
      )
      .sort((a, b) => {
        const sa = computeVipRankingScore(toRankingInput(a));
        const sb = computeVipRankingScore(toRankingInput(b));
        return sb - sa;
      })
      .slice(0, limit)
      .map(strip);

    // Section 2: Trending VIP — mixed tiers, VIP ranking
    const trending = enriched
      .sort((a, b) => {
        const sa = computeVipRankingScore(toRankingInput(a));
        const sb = computeVipRankingScore(toRankingInput(b));
        return sb - sa;
      })
      .slice(0, limit)
      .map(strip);

    // Section 3: Available now — online first
    const availableNow = enriched
      .filter((p) => p.availableNow)
      .sort((a, b) => {
        const sa = computeVipRankingScore(toRankingInput(a));
        const sb = computeVipRankingScore(toRankingInput(b));
        return sb - sa;
      })
      .slice(0, limit)
      .map(strip);

    // Section 4: New arrivals — created in last 14 days
    const newArrivals = enriched
      .filter((p) => new Date(p.createdAt).getTime() >= twoWeeksAgo.getTime())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(strip);

    // Zones — group by city/zone
    const zoneCounts = new Map<string, number>();
    for (const p of enriched) {
      const z = p.zone || "Otra zona";
      zoneCounts.set(z, (zoneCounts.get(z) || 0) + 1);
    }
    const zones = Array.from(zoneCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return res.json({
      platinum,
      trending,
      availableNow,
      newArrivals,
      zones,
    });
  }),
);

/* ── GET /zones/with_supply ───────────────────────────── */

homeRouter.get(
  "/zones/with_supply",
  asyncHandler(async (req, res) => {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const now = new Date();

    const baseWhere: Record<string, unknown> = {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "CREATOR"] },
      isActive: true,
      city: { not: null },
      OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }],
    };
    if (city) {
      (baseWhere as any).city = { equals: city, mode: "insensitive" };
    }

    const groups = await prisma.user.groupBy({
      by: ["city"],
      where: baseWhere as any,
      _count: { id: true },
    });

    const zones = groups
      .filter((g) => g.city)
      .map((g) => ({ name: g.city!, count: g._count.id }))
      .sort((a, b) => b.count - a.count);

    return res.json({ zones });
  }),
);

/* ── helpers ───────────────────────────────────────────── */

function toRankingInput(p: ReturnType<typeof enrichProfile>): RankingInput {
  return {
    id: p.id,
    lastActiveAt: p.lastActiveAt,
    profileViews: p.profileViews,
    availableNow: p.availableNow,
    tier: p.tier,
    distanceKm: p.distanceKm,
  };
}
