import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { findCategoryByRef } from "../lib/categories";
import multer from "multer";
import path from "path";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { validateUploadedFile } from "../lib/uploads";

export const shopRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`
});

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
      const name = `${Date.now()}-${safeBase}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 }
});

function slugifyShopCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeCategoryText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const categoryAliases: Record<string, string[]> = {
  motel: ["moteles"],
  moteles: ["motel"],
  hotelesporhora: ["hoteles", "hotel", "hoteles por hora"],
  hoteles: ["hotel", "hoteles por hora"],
  spas: ["spa", "cafe", "cafes"],
  spa: ["spas", "cafe", "cafes"],
  cafe: ["cafes", "spa", "spas"],
  cafes: ["cafe", "spa", "spas"],
  acompanamiento: ["acompanantes", "acompanante", "acompañamiento"],
  acompanantes: ["acompanamiento", "acompanante", "acompañantes"],
  masaje: ["masajes", "masajes sensuales"],
  masajes: ["masaje", "masajes sensuales"],
  lenceria: ["lencería"],
  juguetes: ["juguetes intimos", "juguetes íntimos"],
  sexshop: ["sex-shop", "sex shop", "shop", "tienda"],
  shop: ["sex-shop", "sexshop", "sex shop", "tienda"],
  "sex-shop": ["sexshop", "shop", "sex shop", "tienda"],
  "sexshop": ["sex-shop", "shop", "sex shop", "tienda"]
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

shopRouter.get("/categories", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (!me || me.profileType !== "SHOP") return res.status(403).json({ error: "NOT_SHOP" });

  const categories = await prisma.shopCategory.findMany({
    where: { shopId: userId },
    orderBy: [{ createdAt: "asc" }]
  });
  return res.json({ categories });
}));

shopRouter.post("/categories", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (!me || me.profileType !== "SHOP") return res.status(403).json({ error: "NOT_SHOP" });

  const name = String(req.body?.name || "").trim();
  if (name.length < 2) return res.status(400).json({ error: "NAME_REQUIRED" });

  const slug = slugifyShopCategory(name);
  if (!slug) return res.status(400).json({ error: "NAME_REQUIRED" });

  const category = await prisma.shopCategory.upsert({
    where: { shopId_slug: { shopId: userId, slug } },
    update: { name },
    create: { shopId: userId, name, slug }
  });

  return res.json({ category });
}));

shopRouter.delete("/categories/:id", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = String(req.params.id);
  const category = await prisma.shopCategory.findFirst({ where: { id, shopId: userId }, select: { id: true } });
  if (!category) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.product.updateMany({ where: { shopId: userId, shopCategoryId: id }, data: { shopCategoryId: null } });
  await prisma.shopCategory.delete({ where: { id } });
  return res.json({ ok: true });
}));

// ✅ PUBLIC: listar sex-shops (para Home / mapa)
shopRouter.get("/sexshops", asyncHandler(async (req, res) => {
  const now = new Date();
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 15)));
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const categorySlug = typeof req.query.categorySlug === "string" ? req.query.categorySlug : typeof req.query.category === "string" ? req.query.category : "";

  const where: any = {
    profileType: "SHOP",
    isActive: true,
    OR: [
      { membershipExpiresAt: { gt: now } },
      { membershipExpiresAt: null }
    ]
  };

  const categoryRef = await findCategoryByRef(prisma, {
    categoryId: categoryId || null,
    categorySlug: categorySlug || null,
    kind: "SHOP"
  });


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
      services: { select: { category: true, categoryId: true }, take: 25, orderBy: { createdAt: "desc" } },
      products: { select: { categoryId: true }, where: { isActive: true }, take: 25, orderBy: { createdAt: "desc" } },
      category: { select: { id: true, name: true, displayName: true, slug: true } }
    },
    take: 200
  });

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
      serviceItemCategories: s.services.map((sv) => sv.category || ""),
      serviceItemCategoryIds: s.services.map((sv) => sv.categoryId || "").filter(Boolean),
      productCategoryIds: s.products.map((p) => p.categoryId || "").filter(Boolean)
    };
  });

  const categoryFiltered = mapped.filter((s) => {
    if (!categoryId && !categorySlug) return true;
    // Accept any sex-shop variant
    if (categoryRef?.slug === "sex-shop" || categoryRef?.slug === "shop" || categoryRef?.slug === "sexshop") return true;
    if (categoryRef?.id && s.category?.id === categoryRef.id) return true;
    if (categoryRef?.id && (s.serviceItemCategoryIds.includes(categoryRef.id) || s.productCategoryIds.includes(categoryRef.id))) return true;
    if (!categoryRef?.displayName && !categoryRef?.name) return false;
    return categoryMatches(categoryRef.displayName || categoryRef.name, s.serviceCategory, s.serviceItemCategories || []);
  });

  const filtered = lat != null && lng != null
    ? categoryFiltered.filter((s) => (s.distance == null ? true : s.distance <= rangeKm))
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
    : categoryFiltered;

  return res.json({
    shops: filtered.map(({ category, serviceCategory, serviceItemCategories, serviceItemCategoryIds, productCategoryIds, ...shop }) => shop)
  });
}));

// ✅ PUBLIC: productos de un sex-shop
shopRouter.get("/sexshops/:shopId/products", asyncHandler(async (req, res) => {
  const shopId = String(req.params.shopId);
  const shopCategoryId = typeof req.query.shopCategoryId === "string" ? req.query.shopCategoryId : "";
  const shopCategorySlug = typeof req.query.shopCategorySlug === "string" ? req.query.shopCategorySlug : "";
  const categoryId = typeof req.query.categoryId === "string" ? req.query.categoryId : "";
  const categorySlug = typeof req.query.categorySlug === "string" ? req.query.categorySlug : typeof req.query.category === "string" ? req.query.category : "";
  const categoryRef = await findCategoryByRef(prisma, {
    categoryId: categoryId || null,
    categorySlug: categorySlug || null,
    kind: "SHOP"
  });
  const products = await prisma.product.findMany({
    where: {
      shopId,
      isActive: true,
      ...(shopCategoryId ? { shopCategoryId } : {}),
      ...(shopCategorySlug ? { shopCategory: { slug: shopCategorySlug } } : {}),
      ...(categoryRef?.id && categoryRef.slug !== "sex-shop" ? { categoryId: categoryRef.id } : {})
    },
    orderBy: { createdAt: "desc" },
    include: {
      media: { orderBy: { pos: "asc" } },
      category: { select: { id: true, slug: true, displayName: true, name: true } },
      shopCategory: { select: { id: true, slug: true, name: true } }
    }
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
    include: {
      media: { orderBy: { pos: "asc" } },
      category: { select: { id: true, slug: true, displayName: true, name: true } },
      shopCategory: { select: { id: true, slug: true, name: true } }
    }
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
  const shopCategoryId = typeof req.body?.shopCategoryId === "string" ? req.body.shopCategoryId : null;

  if (!name || name.length < 2) return res.status(400).json({ error: "NAME_REQUIRED" });
  if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "PRICE_INVALID" });

  if (!shopCategoryId) {
    return res.status(400).json({ error: "CATEGORY_INVALID", message: "Debes elegir una categoría creada por tu tienda." });
  }
  const shopCategory = await prisma.shopCategory.findFirst({ where: { id: shopCategoryId, shopId: userId }, select: { id: true } });
  if (!shopCategory) return res.status(400).json({ error: "CATEGORY_INVALID", message: "Categoría de tienda inválida." });

  const product = await prisma.product.create({
    data: {
      shopId: userId,
      name,
      description,
      price: Math.round(price),
      stock: Math.max(0, Math.round(stock)),
      shopCategoryId,
      media: {
        create: mediaUrls.slice(0, 10).map((url: string, idx: number) => ({ url, pos: idx }))
      }
    },
    include: {
      media: true,
      category: { select: { id: true, slug: true, displayName: true, name: true } },
      shopCategory: { select: { id: true, slug: true, name: true } }
    }
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
  if (req.body?.shopCategoryId !== undefined) {
    const shopCategoryId = req.body?.shopCategoryId ? String(req.body.shopCategoryId) : null;
    if (shopCategoryId) {
      const category = await prisma.shopCategory.findFirst({ where: { id: shopCategoryId, shopId: userId }, select: { id: true } });
      if (!category) {
        return res.status(400).json({ error: "CATEGORY_INVALID", message: "Categoría de tienda inválida." });
      }
    }
    data.shopCategoryId = shopCategoryId;
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
    include: {
      media: true,
      category: { select: { id: true, slug: true, displayName: true, name: true } },
      shopCategory: { select: { id: true, slug: true, name: true } }
    }
  });
  return res.json({ product: updated });
}));

shopRouter.post("/products/:id/media", requireAuth, upload.array("files", 8), asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = String(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, select: { shopId: true } });
  if (!product || product.shopId !== userId) return res.status(404).json({ error: "NOT_FOUND" });

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) return res.status(400).json({ error: "NO_FILES" });
  const lastPos = await prisma.productMedia.findFirst({ where: { productId: id }, orderBy: { pos: "desc" }, select: { pos: true } });
  const media = [];
  let pos = (lastPos?.pos ?? -1) + 1;
  for (const file of files) {
    await validateUploadedFile(file, "image-or-video");
    const url = storageProvider.publicUrl(file.filename);
    media.push(await prisma.productMedia.create({ data: { productId: id, url, pos } }));
    pos += 1;
  }
  return res.json({ media });
}));

shopRouter.delete("/products/media/:mediaId", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const mediaId = String(req.params.mediaId);
  const media = await prisma.productMedia.findUnique({ where: { id: mediaId }, include: { product: { select: { shopId: true } } } });
  if (!media || media.product.shopId !== userId) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.productMedia.delete({ where: { id: mediaId } });
  return res.json({ ok: true });
}));

shopRouter.delete("/products/:id", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const id = String(req.params.id);
  const product = await prisma.product.findUnique({ where: { id }, select: { shopId: true } });
  if (!product || product.shopId !== userId) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.product.delete({ where: { id } });
  return res.json({ ok: true });
}));
