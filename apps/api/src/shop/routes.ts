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
import { optimizeUploadedImage } from "../lib/imageOptimizer";
import { sendToUser } from "../realtime/sse";
import { safeUploadFilename } from "../lib/uploadFilename";

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
      cb(null, safeUploadFilename(file));
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
    businessPublished: true,
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
      businessOpen: true,
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
      isOpen: s.businessOpen,
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

  /* ── Quick listings (externalOnly) from Establishment table ── */
  const quickListings = await prisma.establishment.findMany({
    where: {
      externalOnly: true,
      category: { kind: "SHOP" },
    },
    include: { category: { select: { id: true, name: true, displayName: true, slug: true } } },
  });

  const quickMapped = quickListings.map((ql) => {
    const distance = lat != null && lng != null && ql.latitude != null && ql.longitude != null
      ? distKm(lat, lng, ql.latitude, ql.longitude)
      : null;
    return {
      id: ql.id,
      username: ql.id,
      name: ql.name,
      avatarUrl: ql.galleryUrls?.[0] || null,
      city: ql.city,
      address: ql.address,
      latitude: ql.latitude,
      longitude: ql.longitude,
      distance,
      websiteUrl: ql.websiteUrl,
      externalOnly: true,
    };
  })
    .filter((ql) => (ql.distance != null && lat != null && lng != null ? ql.distance <= rangeKm : true))
    .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  const cleanedFiltered = filtered.map(({ category, serviceCategory, serviceItemCategories, serviceItemCategoryIds, productCategoryIds, ...shop }) => shop);
  const allShops = [...cleanedFiltered, ...quickMapped].sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({ shops: allShops });
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
    const { type } = await validateUploadedFile(file, "image-or-video");
    const finalFilename = type === "IMAGE" ? await optimizeUploadedImage(file, "gallery") : file.filename;
    const url = storageProvider.publicUrl(finalFilename);
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

/* ─────────────────────────────────────────────────────────
   Shop Order / Checkout system (raw SQL, like motel module)
   ───────────────────────────────────────────────────────── */

let shopOrderSchemaReady = false;
async function ensureShopOrderSchema() {
  if (shopOrderSchemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShopOrder" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "shopId" TEXT NOT NULL,
      "clientId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "totalClp" INTEGER NOT NULL DEFAULT 0,
      "deliveryAddress" TEXT,
      "deliveryPhone" TEXT,
      "deliveryNote" TEXT,
      "paymentMethod" TEXT DEFAULT 'CASH',
      "createdAt" TIMESTAMP DEFAULT NOW(),
      "updatedAt" TIMESTAMP DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ShopOrderItem" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "orderId" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "productName" TEXT NOT NULL,
      "unitPrice" INTEGER NOT NULL,
      "quantity" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TIMESTAMP DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShopOrder_shopId_idx" ON "ShopOrder" ("shopId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShopOrder_clientId_idx" ON "ShopOrder" ("clientId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShopOrderItem_orderId_idx" ON "ShopOrderItem" ("orderId")`);

  shopOrderSchemaReady = true;
}

// Ensure schema is created at module load (like motel module)
ensureShopOrderSchema().catch(() => {});

/* Las columnas "shopId", "clientId" y "orderId" son TEXT (así nacieron las
   tablas). Compararlas con `$1::uuid` hacía fallar la consulta en Postgres
   ("operator does not exist: text = uuid"): la tienda nunca veía sus pedidos.
   Se comparan como texto; sólo "id" es UUID. */

const PAYMENT_METHODS = new Set(["CASH", "TRANSFER"]);
const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  SHIPPED: "En camino",
  DELIVERED: "Entregado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function clp(value: number) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

function orderRef(id: string) {
  return String(id).slice(0, 8).toUpperCase();
}

/** Mensaje de chat + notificación + aviso en vivo. Nunca bota el pedido. */
async function notifyOrder(fromId: string, toId: string, text: string, title: string, url: string, orderId: string) {
  try {
    const message = await prisma.message.create({ data: { fromId, toId, body: text } });
    sendToUser(toId, "message", { message });
  } catch (err: any) {
    console.error("[shop] order chat message failed:", err?.message || err);
  }
  await prisma.notification
    .create({ data: { userId: toId, type: "BOOKING_UPDATE", data: { title, body: text.split("\n")[0].slice(0, 120), orderId, url } } })
    .catch((err) => console.error("[shop] order notification failed:", err?.message || err));
  sendToUser(toId, "shop:order", { orderId });
}

async function attachItems(orders: any[]) {
  const orderIds = orders.map((o) => String(o.id));
  if (!orderIds.length) return orders;
  const allItems = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "ShopOrderItem" WHERE "orderId" = ANY($1::text[]) ORDER BY "createdAt" ASC`,
    orderIds
  );
  const itemsByOrder = new Map<string, any[]>();
  for (const item of allItems) {
    const list = itemsByOrder.get(String(item.orderId)) || [];
    list.push(item);
    itemsByOrder.set(String(item.orderId), list);
  }
  return orders.map((o) => ({ ...o, items: itemsByOrder.get(String(o.id)) || [] }));
}

// POST /orders - Client creates an order
shopRouter.post("/orders", requireAuth, asyncHandler(async (req, res) => {
  await ensureShopOrderSchema();
  const clientId = req.session.userId!;

  const rawItems: Array<{ productId: string; quantity: number }> = Array.isArray(req.body?.items) ? req.body.items : [];
  /* Un mismo producto repetido en el carrito se suma en una sola línea. */
  const qtyByProduct = new Map<string, number>();
  for (const item of rawItems.slice(0, 50)) {
    const productId = String(item?.productId || "");
    if (!isUuid(productId)) continue;
    const qty = Math.max(1, Math.min(99, Math.round(Number(item?.quantity) || 1)));
    qtyByProduct.set(productId, Math.min(99, (qtyByProduct.get(productId) || 0) + qty));
  }
  if (!qtyByProduct.size) return res.status(400).json({ error: "ITEMS_REQUIRED", message: "Tu carrito está vacío." });

  const deliveryAddress = req.body?.deliveryAddress ? String(req.body.deliveryAddress).trim().slice(0, 300) || null : null;
  const deliveryPhone = req.body?.deliveryPhone ? String(req.body.deliveryPhone).trim().slice(0, 30) || null : null;
  const deliveryNote = req.body?.deliveryNote ? String(req.body.deliveryNote).trim().slice(0, 500) || null : null;
  const paymentMethod = PAYMENT_METHODS.has(String(req.body?.paymentMethod || "").toUpperCase())
    ? String(req.body.paymentMethod).toUpperCase()
    : "CASH";

  const productIds = Array.from(qtyByProduct.keys());
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    select: { id: true, shopId: true, name: true, price: true, stock: true }
  });

  if (products.length !== productIds.length) {
    return res.status(400).json({ error: "PRODUCT_NOT_FOUND", message: "Uno de los productos ya no está disponible. Revisa tu carrito." });
  }

  const shopIds = Array.from(new Set(products.map((p) => p.shopId)));
  if (shopIds.length !== 1) {
    return res.status(400).json({ error: "MULTI_SHOP_ORDER", message: "Todos los productos deben ser de la misma tienda." });
  }
  const shopId = shopIds[0];
  if (shopId === clientId) {
    return res.status(400).json({ error: "OWN_SHOP", message: "No puedes comprar en tu propia tienda." });
  }

  const shop = await prisma.user.findUnique({
    where: { id: shopId },
    select: { displayName: true, username: true, isActive: true, businessOpen: true, businessPublished: true }
  });
  if (!shop || !shop.isActive || !shop.businessPublished) {
    return res.status(404).json({ error: "SHOP_NOT_FOUND", message: "La tienda no está disponible." });
  }
  if (!shop.businessOpen) {
    return res.status(409).json({ error: "CLOSED", message: "La tienda está cerrada en este momento y no recibe pedidos." });
  }

  const productMap = new Map(products.map((p) => [p.id, p]));
  for (const [productId, qty] of qtyByProduct) {
    const product = productMap.get(productId)!;
    if (product.stock < qty) {
      return res.status(400).json({
        error: "INSUFFICIENT_STOCK",
        productId,
        available: product.stock,
        message: product.stock > 0
          ? `Sólo ${product.stock === 1 ? "queda 1" : `quedan ${product.stock}`} de "${product.name}".`
          : `"${product.name}" está agotado.`,
      });
    }
  }

  let totalClp = 0;
  const resolvedItems = productIds.map((productId) => {
    const product = productMap.get(productId)!;
    const qty = qtyByProduct.get(productId)!;
    totalClp += product.price * qty;
    return { productId, productName: product.name, unitPrice: product.price, quantity: qty };
  });

  // Atomic: create order + decrement stock in a single transaction
  const result = await prisma.$transaction(async (tx) => {
    for (const ri of resolvedItems) {
      /* Descuento condicionado: si otro pedido se llevó el stock entre la
         validación y acá, no se actualiza ninguna fila y se aborta. */
      const updated = await tx.product.updateMany({
        where: { id: ri.productId, stock: { gte: ri.quantity } },
        data: { stock: { decrement: ri.quantity } }
      });
      if (updated.count !== 1) throw new Error(`INSUFFICIENT_STOCK:${ri.productId}`);
    }

    const orderRows = await tx.$queryRawUnsafe<any[]>(
      `INSERT INTO "ShopOrder" ("shopId", "clientId", "status", "totalClp", "deliveryAddress", "deliveryPhone", "deliveryNote", "paymentMethod")
       VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7)
       RETURNING *`,
      shopId, clientId, totalClp, deliveryAddress, deliveryPhone, deliveryNote, paymentMethod
    );
    const order = orderRows[0];

    const orderItems: any[] = [];
    for (const ri of resolvedItems) {
      const itemRows = await tx.$queryRawUnsafe<any[]>(
        `INSERT INTO "ShopOrderItem" ("orderId", "productId", "productName", "unitPrice", "quantity")
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        String(order.id), ri.productId, ri.productName, ri.unitPrice, ri.quantity
      );
      orderItems.push(itemRows[0]);
    }

    return { ...order, items: orderItems };
  }).catch((err) => {
    if (err?.message?.startsWith("INSUFFICIENT_STOCK:")) return null;
    throw err;
  });

  if (!result) {
    return res.status(400).json({ error: "INSUFFICIENT_STOCK", message: "El stock cambió mientras comprabas. Revisa tu carrito e intenta de nuevo." });
  }

  /* La tienda se entera por chat (donde coordina entrega y pago), por la
     campana y en vivo en su panel. */
  const lines = resolvedItems.map((ri) => `• ${ri.productName} x${ri.quantity} (${clp(ri.unitPrice * ri.quantity)})`).join("\n");
  const summary = [
    `🛍️ Nuevo pedido #${orderRef(result.id)}`,
    lines,
    `Total: ${clp(totalClp)}`,
    `Pago: ${paymentMethod === "TRANSFER" ? "Transferencia" : "Efectivo"}`,
    deliveryAddress ? `Entrega: ${deliveryAddress}` : "Entrega: por coordinar",
    deliveryPhone ? `Teléfono: ${deliveryPhone}` : "",
    deliveryNote ? `Nota: ${deliveryNote}` : "",
  ].filter(Boolean).join("\n");
  await notifyOrder(clientId, shopId, summary, "Nuevo pedido en tu tienda", "/dashboard/shop?tab=orders", String(result.id));

  return res.json({ order: result });
}));

// GET /orders - Client lists their orders
shopRouter.get("/orders", requireAuth, asyncHandler(async (req, res) => {
  await ensureShopOrderSchema();
  const clientId = req.session.userId!;

  const orders = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o.*, s."displayName" AS "shopName", s."username" AS "shopUsername"
     FROM "ShopOrder" o
     LEFT JOIN "User" s ON s.id::text = o."shopId"
     WHERE o."clientId" = $1
     ORDER BY o."createdAt" DESC LIMIT 200`,
    clientId
  );
  return res.json({ orders: await attachItems(orders) });
}));

// GET /orders/shop - Shop owner lists orders for their shop
shopRouter.get("/orders/shop", requireAuth, asyncHandler(async (req, res) => {
  await ensureShopOrderSchema();
  const userId = req.session.userId!;

  const me = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (!me || me.profileType !== "SHOP") return res.status(403).json({ error: "NOT_SHOP" });

  const orders = await prisma.$queryRawUnsafe<any[]>(
    `SELECT o.*, c."displayName" AS "clientName", c."username" AS "clientUsername"
     FROM "ShopOrder" o
     LEFT JOIN "User" c ON c.id::text = o."clientId"
     WHERE o."shopId" = $1
     ORDER BY o."createdAt" DESC LIMIT 200`,
    userId
  );
  return res.json({ orders: await attachItems(orders) });
}));

// GET /orders/:id - Get single order detail
shopRouter.get("/orders/:id", requireAuth, asyncHandler(async (req, res) => {
  await ensureShopOrderSchema();
  const userId = req.session.userId!;
  const orderId = String(req.params.id);
  if (!isUuid(orderId)) return res.status(404).json({ error: "NOT_FOUND" });

  const orderRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "ShopOrder" WHERE "id" = $1::uuid LIMIT 1`,
    orderId
  );
  const order = orderRows[0];
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  if (String(order.clientId) !== userId && String(order.shopId) !== userId) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  const [withItems] = await attachItems([order]);
  return res.json({ order: withItems });
}));

// POST /orders/:id/action - Update order status
shopRouter.post("/orders/:id/action", requireAuth, asyncHandler(async (req, res) => {
  await ensureShopOrderSchema();
  const userId = req.session.userId!;
  const orderId = String(req.params.id);
  if (!isUuid(orderId)) return res.status(404).json({ error: "NOT_FOUND" });
  const action = String(req.body?.action || "").toUpperCase();
  const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 300) : "";

  const orderRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "ShopOrder" WHERE "id" = $1::uuid LIMIT 1`,
    orderId
  );
  const order = orderRows[0];
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  const isShopOwner = String(order.shopId) === userId;
  const isClient = String(order.clientId) === userId;
  if (!isShopOwner && !isClient) return res.status(403).json({ error: "FORBIDDEN" });

  let nextStatus: string | null = null;
  if (isShopOwner && action === "ACCEPT" && order.status === "PENDING") nextStatus = "ACCEPTED";
  if (isShopOwner && action === "REJECT" && ["PENDING", "ACCEPTED"].includes(order.status)) nextStatus = "REJECTED";
  if (isShopOwner && action === "SHIP" && order.status === "ACCEPTED") nextStatus = "SHIPPED";
  /* Retiro en tienda o entrega en mano: se puede marcar entregado sin pasar por "en camino". */
  if (isShopOwner && action === "DELIVER" && ["ACCEPTED", "SHIPPED"].includes(order.status)) nextStatus = "DELIVERED";
  if (isClient && action === "DELIVER" && order.status === "SHIPPED") nextStatus = "DELIVERED";
  if (isClient && action === "CANCEL" && order.status === "PENDING") nextStatus = "CANCELLED";

  if (!nextStatus) return res.status(400).json({ error: "INVALID_TRANSITION", message: "El pedido ya cambió de estado. Actualiza la página." });

  const releasesStock = nextStatus === "REJECTED" || nextStatus === "CANCELLED";
  const updated = await prisma.$transaction(async (tx) => {
    /* El WHERE con el estado anterior evita que dos clics o dos pestañas
       devuelvan el stock dos veces. */
    const rows = await tx.$queryRawUnsafe<any[]>(
      `UPDATE "ShopOrder" SET "status" = $1, "updatedAt" = NOW() WHERE "id" = $2::uuid AND "status" = $3 RETURNING *`,
      nextStatus,
      orderId,
      order.status
    );
    if (!rows[0]) return null;
    if (releasesStock) {
      const items = await tx.$queryRawUnsafe<any[]>(
        `SELECT "productId", "quantity" FROM "ShopOrderItem" WHERE "orderId" = $1`,
        orderId
      );
      for (const item of items) {
        await tx.product.updateMany({
          where: { id: String(item.productId) },
          data: { stock: { increment: Number(item.quantity) || 0 } }
        });
      }
    }
    return rows[0];
  });
  if (!updated) return res.status(409).json({ error: "INVALID_TRANSITION", message: "El pedido ya cambió de estado. Actualiza la página." });

  const ref = orderRef(orderId);
  const label = ORDER_STATUS_LABEL[nextStatus] || nextStatus;
  if (isShopOwner) {
    const detail =
      nextStatus === "ACCEPTED" ? "La tienda aceptó tu pedido. Coordinen por aquí la entrega y el pago."
      : nextStatus === "SHIPPED" ? "Tu pedido va en camino."
      : nextStatus === "DELIVERED" ? "La tienda marcó tu pedido como entregado. ¡Gracias por tu compra!"
      : `La tienda no pudo tomar tu pedido.${reason ? ` Motivo: ${reason}` : ""}`;
    await notifyOrder(userId, String(order.clientId), `Pedido #${ref}: ${label}\n${detail}`, "Actualización de tu pedido", `/chat/${userId}`, orderId);
  } else {
    const detail = nextStatus === "CANCELLED" ? "El cliente canceló el pedido. El stock volvió a tu inventario." : "El cliente confirmó que recibió el pedido.";
    await notifyOrder(userId, String(order.shopId), `Pedido #${ref}: ${label}\n${detail}`, "Actualización de pedido", "/dashboard/shop?tab=orders", orderId);
  }

  const [withItems] = await attachItems([updated]);
  return res.json({ order: withItems });
}));
