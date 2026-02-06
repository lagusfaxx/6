import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const shopRouter = Router();

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

// ✅ PUBLIC: listar sex-shops (para Home / mapa)
shopRouter.get("/sexshops", asyncHandler(async (req, res) => {
  const now = new Date();
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 15)));
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";

  const where: any = {
    profileType: "SHOP",
    isActive: true,
    OR: [
      { membershipExpiresAt: { gt: now } },
      // en dev puede venir null; si quieres forzar pago, comenta esta línea
      { membershipExpiresAt: null }
    ]
  };

  const categoryRef = categoryId
    ? await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, name: true } })
    : null;


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
      longitude: true,
      serviceCategory: true,
      services: { select: { category: true }, take: 25, orderBy: { createdAt: "desc" } },
      category: { select: { id: true, name: true } }
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
      distance,
      category: s.category,
      serviceCategory: s.serviceCategory,
      serviceItemCategories: s.services.map((sv) => sv.category || "")
    };
  });

  const categoryFiltered = mapped.filter((s) => {
    if (!categoryId) return true;
    if (s.category?.id === categoryId) return true;
    if (!categoryRef?.name) return false;
    return categoryMatches(categoryRef.name, s.serviceCategory, s.serviceItemCategories || []);
  });

  const filtered = lat != null && lng != null
    ? categoryFiltered.filter((s) => (s.distance == null ? true : s.distance <= rangeKm))
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
    : categoryFiltered;

  return res.json({ shops: filtered.map(({ category, serviceCategory, serviceItemCategories, ...shop }) => shop) });
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
