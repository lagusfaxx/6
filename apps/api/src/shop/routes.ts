import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const shopRouter = Router();

// ✅ PUBLIC: listar sex-shops (para Home / mapa)
shopRouter.get("/sexshops", asyncHandler(async (req, res) => {
  const now = new Date();
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 15)));
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const where: any = {
    profileType: "SHOP",
    isActive: true,
    OR: [
      { membershipExpiresAt: { gt: now } },
      // en dev puede venir null; si quieres forzar pago, comenta esta línea
      { membershipExpiresAt: null }
    ]
  };

  const shops = await prisma.user.findMany({
    where,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      city: true,
      address: true,
      latitude: true,
      longitude: true
    },
    take: 200
  });

  // distancia aproximada (Haversine)
  const toRad = (v: number) => (v * Math.PI) / 180;
  function distKm(aLat: number, aLng: number, bLat: number, bLng: number) {
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const sa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
  }

  const mapped = shops.map((s) => {
    const distance = lat != null && lng != null && s.latitude != null && s.longitude != null
      ? distKm(lat, lng, s.latitude, s.longitude)
      : null;
    return {
      id: s.id,
      username: s.username,
      name: s.displayName || s.username,
      avatarUrl: s.avatarUrl,
      city: s.city,
      address: s.address,
      latitude: s.latitude,
      longitude: s.longitude,
      distance
    };
  });

  const filtered = lat != null && lng != null
    ? mapped.filter((s) => (s.distance == null ? true : s.distance <= rangeKm))
             .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
    : mapped;

  return res.json({ shops: filtered });
}));

// ✅ PUBLIC: productos de un sex-shop
shopRouter.get("/sexshops/:shopId/products", asyncHandler(async (req, res) => {
  const shopId = String(req.params.shopId);
  const products = await prisma.product.findMany({
    where: { shopId, isActive: true },
    orderBy: { createdAt: "desc" },
    include: { media: { orderBy: { pos: "asc" } } }
  });
  return res.json({ products });
}));

// 🔒 CRUD para shop dueño
shopRouter.get("/products", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (!me || me.profileType !== "SHOP") return res.status(403).json({ error: "NOT_SHOP" });

  const products = await prisma.product.findMany({
    where: { shopId: userId },
    orderBy: { createdAt: "desc" },
    include: { media: { orderBy: { pos: "asc" } } }
  });
  return res.json({ products });
}));

shopRouter.post("/products", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (!me || me.profileType !== "SHOP") return res.status(403).json({ error: "NOT_SHOP" });

  const name = String(req.body?.name || "").trim();
  const price = Number(req.body?.price || 0);
  const stock = Number(req.body?.stock || 0);
  const description = req.body?.description ? String(req.body.description) : null;
  const mediaUrls = Array.isArray(req.body?.mediaUrls) ? req.body.mediaUrls.map(String) : [];

  if (!name || name.length < 2) return res.status(400).json({ error: "NAME_REQUIRED" });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "PRICE_INVALID" });

  const product = await prisma.product.create({
    data: {
      shopId: userId,
      name,
      description,
      price: Math.round(price),
      stock: Math.max(0, Math.round(stock)),
      media: {
        create: mediaUrls.slice(0, 10).map((url: string, idx: number) => ({ url, pos: idx }))
      }
    },
    include: { media: true }
  });

  return res.json({ product });
}));

shopRouter.patch("/products/:id", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = String(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, select: { shopId: true } });
  if (!product || product.shopId !== userId) return res.status(404).json({ error: "NOT_FOUND" });

  const data: any = {};
  if (req.body?.name != null) data.name = String(req.body.name).trim();
  if (req.body?.description !== undefined) data.description = req.body.description ? String(req.body.description) : null;
  if (req.body?.price != null) data.price = Math.round(Number(req.body.price));
  if (req.body?.stock != null) data.stock = Math.max(0, Math.round(Number(req.body.stock)));
  if (req.body?.isActive != null) data.isActive = Boolean(req.body.isActive);

  const updated = await prisma.product.update({ where: { id }, data, include: { media: true } });
  return res.json({ product: updated });
}));

shopRouter.delete("/products/:id", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = String(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, select: { shopId: true } });
  if (!product || product.shopId !== userId) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.product.delete({ where: { id } });
  return res.json({ ok: true });
}));
