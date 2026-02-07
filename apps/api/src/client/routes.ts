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
