import { Router } from "express";
import { prisma } from "../db";

export const clientRouter = Router();

/**
 * ✅ PUBLICO: categorías para Home (sin login)
 */
clientRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { displayName: "asc" }
    });
    return res.json(
      categories.map((c) => ({
        ...c,
        displayName: c.displayName || c.name,
        slug: c.slug || c.name
      }))
    );
  } catch (err) {
    return next(err);
  }
});


/**
 * ✅ PUBLICO: banners activos para Home
 */
clientRouter.get("/banners", async (_req, res, next) => {
  try {
    const bannerClient = (prisma as any).banner;
    if (!bannerClient?.findMany) {
      return res.json({ banners: [] });
    }
    const banners = await bannerClient.findMany({
      where: { isActive: true },
      orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }]
    });
    return res.json({ banners });
  } catch (err) {
    return next(err);
  }
});

clientRouter.get("/popup-promotions", async (_req, res, next) => {
  try {
    const now = new Date();
    const promotions = await prisma.banner.findMany({
      where: {
        isActive: true,
        position: "POPUP_PROMO",
        professionalId: { not: null },
        promoImageUrl: { not: null },
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        sortOrder: true,
        promoImageUrl: true,
        professionalId: true,
        adTier: true,
      },
    });

    if (!promotions.length) {
      return res.json({ promotions: [] });
    }

    const professionalIds = promotions
      .map((p) => p.professionalId)
      .filter((id): id is string => Boolean(id));

    const [pros, reviews] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: professionalIds }, isActive: true, profileType: "PROFESSIONAL" },
        select: {
          id: true,
          username: true,
          displayName: true,
          isOnline: true,
          lastSeen: true,
        },
      }),
      prisma.professionalReview.findMany({
        where: { serviceRequest: { professionalId: { in: professionalIds } } },
        select: { hearts: true, serviceRequest: { select: { professionalId: true } } },
      }),
    ]);

    const byId = new Map(pros.map((p) => [p.id, p]));
    const ratings = new Map<string, { sum: number; count: number }>();
    for (const review of reviews) {
      const pid = review.serviceRequest.professionalId;
      const current = ratings.get(pid) ?? { sum: 0, count: 0 };
      ratings.set(pid, { sum: current.sum + review.hearts, count: current.count + 1 });
    }

    const payload = promotions
      .map((promo) => {
        const pro = promo.professionalId ? byId.get(promo.professionalId) : null;
        if (!pro || !promo.promoImageUrl) return null;
        const stats = ratings.get(pro.id);
        const rating = stats ? Number((stats.sum / stats.count).toFixed(2)) : null;
        return {
          id: promo.id,
          sortOrder: promo.sortOrder,
          promoImageUrl: promo.promoImageUrl,
          adTier: promo.adTier === "GOLD" ? "GOLD" : "STANDARD",
          professional: {
            id: pro.id,
            name: pro.displayName || pro.username || "Profesional",
            username: pro.username,
            isOnline: pro.isOnline,
            lastSeen: pro.lastSeen,
            rating,
            reviewsCount: stats?.count ?? 0,
            profileUrl: `/profesional/${pro.id}`,
          },
        };
      })
      .filter(Boolean);

    return res.json({ promotions: payload });
  } catch (err) {
    return next(err);
  }
});
