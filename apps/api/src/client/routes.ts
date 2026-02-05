import { Router } from "express";
import { prisma } from "../db";

export const clientRouter = Router();

/**
 * ✅ PUBLICO: categorías para Home (sin login)
 */
clientRouter.get("/categories", async (_req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" }
    });
    return res.json(categories);
  } catch (err) {
    return next(err);
  }
});
