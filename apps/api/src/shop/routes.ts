import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

export const shopRouter = Router();

// ===============================
// LISTADO DE TIENDAS
// ===============================
shopRouter.get(
  "/shops",
  asyncHandler(async (req, res) => {
    const now = new Date();

    const shops = await prisma.user.findMany({
      where: {
        profileType: "SHOP",
        isActive: true,
        OR: [{ membershipExpiresAt: { gt: now } }, { membershipExpiresAt: null }]
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        city: true,
        address: true,
        phone: true
      },
      take: 200
    });

    return res.json({ shops });
  })
);

// ===============================
// TIENDA (DETALLE)
// ===============================
shopRouter.get(
  "/shops/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);

    const shop = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        city: true,
        address: true,
        phone: true,
        products: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            price: true,
            images: true
          }
        }
      }
    });

    if (!shop) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    return res.json({ shop });
  })
);
