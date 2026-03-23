import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

export const analyticsRouter = Router();

/* ─── Track page view (called from frontend) ─── */

analyticsRouter.post(
  "/analytics/pageview",
  asyncHandler(async (req, res) => {
    const { path, referrer, sessionId } = req.body;
    if (!path || typeof path !== "string") {
      return res.status(400).json({ error: "path required" });
    }

    const userId = req.session?.userId || null;
    const userAgent = req.headers["user-agent"] || null;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.ip;

    // Basic city/country from Cloudflare or similar headers
    const city = (req.headers["cf-ipcity"] as string) || (req.headers["x-vercel-ip-city"] as string) || null;
    const country = (req.headers["cf-ipcountry"] as string) || (req.headers["x-vercel-ip-country"] as string) || null;

    await prisma.pageView.create({
      data: {
        path: path.slice(0, 500),
        userId,
        sessionId: sessionId || null,
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        city,
        country,
      },
    });

    res.json({ ok: true });
  }),
);

/* ─── Track user action (called from frontend) ─── */

analyticsRouter.post(
  "/analytics/action",
  asyncHandler(async (req, res) => {
    const { action, targetId, metadata } = req.body;
    if (!action || typeof action !== "string") {
      return res.status(400).json({ error: "action required" });
    }

    const userId = req.session?.userId || null;

    await prisma.userAction.create({
      data: {
        action: action.slice(0, 100),
        userId,
        targetId: targetId || null,
        metadata: metadata || null,
      },
    });

    res.json({ ok: true });
  }),
);

/* ─── Admin: comprehensive analytics dashboard ─── */

analyticsRouter.get(
  "/admin/analytics",
  asyncHandler(async (req, res) => {
    // Only allow admin
    if (!req.session?.userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") return res.status(403).json({ error: "FORBIDDEN" });

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const period = String(req.query.period || "7d");
    const periodStart = period === "30d" ? thirtyDaysAgo : period === "24h" ? yesterday : sevenDaysAgo;

    const [
      // Visits
      totalPageViews,
      todayPageViews,
      uniqueVisitors,
      topPages,
      // User counts
      totalUsers,
      totalProfessionals,
      newUsersToday,
      activeUsersToday,
      // Actions
      topActions,
      // Locations
      topCities,
      topCountries,
      // Interactions
      totalMessages,
      totalVideocallBookings,
      totalServiceRequests,
      totalFavorites,
      // Daily breakdown
      dailyViews,
      dailyNewUsers,
      // Profile stats
      profilesWithoutPhotos,
      inactiveProfiles,
    ] = await Promise.all([
      // Total page views in period
      prisma.pageView.count({ where: { createdAt: { gte: periodStart } } }),
      // Today's views
      prisma.pageView.count({ where: { createdAt: { gte: today } } }),
      // Unique visitors (by sessionId or userId)
      prisma.pageView.groupBy({
        by: ["sessionId"],
        where: { createdAt: { gte: periodStart }, sessionId: { not: null } },
      }).then((r) => r.length),
      // Top pages
      prisma.pageView.groupBy({
        by: ["path"],
        where: { createdAt: { gte: periodStart } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 15,
      }),
      // Total users
      prisma.user.count(),
      // Total professionals
      prisma.user.count({ where: { profileType: "PROFESSIONAL" } }),
      // New users today
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      // Active users today
      prisma.user.count({
        where: { OR: [{ isOnline: true }, { lastSeen: { gte: today } }] },
      }),
      // Top user actions
      prisma.userAction.groupBy({
        by: ["action"],
        where: { createdAt: { gte: periodStart } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 15,
      }),
      // Top cities
      prisma.pageView.groupBy({
        by: ["city"],
        where: { createdAt: { gte: periodStart }, city: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      // Top countries
      prisma.pageView.groupBy({
        by: ["country"],
        where: { createdAt: { gte: periodStart }, country: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      // Messages in period
      prisma.message.count({ where: { createdAt: { gte: periodStart } } }),
      // Videocall bookings in period
      prisma.videocallBooking.count({ where: { createdAt: { gte: periodStart } } }),
      // Service requests in period
      prisma.serviceRequest.count({ where: { createdAt: { gte: periodStart } } }),
      // Favorites in period
      prisma.favorite.count({ where: { createdAt: { gte: periodStart } } }),
      // Daily page views breakdown (last 7 or 30 days)
      prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(
        `SELECT DATE("createdAt") as day, COUNT(*)::bigint as count
         FROM "PageView"
         WHERE "createdAt" >= $1
         GROUP BY DATE("createdAt")
         ORDER BY day ASC`,
        periodStart,
      ),
      // Daily new users breakdown
      prisma.$queryRawUnsafe<{ day: string; count: bigint }[]>(
        `SELECT DATE("createdAt") as day, COUNT(*)::bigint as count
         FROM "User"
         WHERE "createdAt" >= $1
         GROUP BY DATE("createdAt")
         ORDER BY day ASC`,
        periodStart,
      ),
      // Professionals without photos
      prisma.user.count({
        where: {
          profileType: "PROFESSIONAL",
          avatarUrl: null,
          coverUrl: null,
        },
      }),
      // Inactive professionals (no login in 48h+)
      prisma.user.count({
        where: {
          profileType: "PROFESSIONAL",
          OR: [
            { lastSeen: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) } },
            { lastSeen: null },
          ],
        },
      }),
    ]);

    res.json({
      period,
      visits: {
        total: totalPageViews,
        today: todayPageViews,
        uniqueVisitors,
        topPages: topPages.map((p) => ({ path: p.path, count: p._count.id })),
        daily: dailyViews.map((d) => ({ day: String(d.day), count: Number(d.count) })),
      },
      users: {
        total: totalUsers,
        professionals: totalProfessionals,
        newToday: newUsersToday,
        activeToday: activeUsersToday,
        dailyNew: dailyNewUsers.map((d) => ({ day: String(d.day), count: Number(d.count) })),
        profilesWithoutPhotos,
        inactiveProfiles,
      },
      actions: {
        top: topActions.map((a) => ({ action: a.action, count: a._count.id })),
      },
      interactions: {
        messages: totalMessages,
        videocallBookings: totalVideocallBookings,
        serviceRequests: totalServiceRequests,
        favorites: totalFavorites,
      },
      locations: {
        cities: topCities.map((c) => ({ city: c.city, count: c._count.id })),
        countries: topCountries.map((c) => ({ country: c.country, count: c._count.id })),
      },
    });
  }),
);
