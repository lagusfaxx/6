import { Router } from "express";
import { prisma } from "../db";

export const clientRouter = Router();

clientRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ order: "asc" }, { displayName: "asc" }],
    });
    return res.json(
      categories.map((c) => ({
        ...c,
        displayName: c.displayName || c.name,
        slug: c.slug || c.name,
      })),
    );
  } catch (err) {
    return next(err);
  }
});

clientRouter.get("/banners", async (_req, res, next) => {
  try {
    const bannerClient = (prisma as any).banner;
    if (!bannerClient?.findMany) {
      return res.json({ banners: [] });
    }
    const banners = await bannerClient.findMany({
      where: { isActive: true },
      orderBy: [
        { position: "asc" },
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });
    return res.json({ banners });
  } catch (err) {
    return next(err);
  }
});

clientRouter.get("/ads", async (req, res, next) => {
  try {
    const placement =
      typeof req.query.placement === "string"
        ? req.query.placement.toUpperCase()
        : undefined;
    const now = new Date();
    const ads = await prisma.ad.findMany({
      where: {
        isActive: true,
        ...(placement &&
        ["RIGHT_VERTICAL", "BOTTOM_HORIZONTAL"].includes(placement)
          ? { placement: placement as any }
          : {}),
        OR: [{ startAt: null }, { startAt: { lte: now } }],
        AND: [{ OR: [{ endAt: null }, { endAt: { gte: now } }] }],
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    return res.json({ ads });
  } catch (err) {
    return next(err);
  }
});

clientRouter.get("/attributes", async (_req, res, next) => {
  try {
    const attributes = await prisma.profileAttribute.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { label: "asc" }],
    });
    return res.json({ attributes });
  } catch (err) {
    return next(err);
  }
});

clientRouter.get("/terms/active", async (_req, res, next) => {
  try {
    const active = await prisma.termsVersion.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ terms: active });
  } catch (err) {
    return next(err);
  }
});
