import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MarketDeliveryMethod, MarketProductType, Prisma } from "@prisma/client";

import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { createFlowPayment } from "../khipu/client";
import {
  sendMarketOrderDeliveredEmail,
  sendMarketTransferInstructionsEmail,
} from "../lib/marketEmail";
import { getMarketSettings, publicTransferData, splitAmounts, transferDataComplete } from "./settings";
import {
  buildOrderAssetUrl,
  isPrivateRef,
  privateRefToRelPath,
  savePrivate,
  streamOrderAsset,
  verifyOrderAssetSignature,
  MARKET_ASSET_FOLDER,
} from "./media";
import {
  confirmOrderPaid,
  deliverDigitalAssets,
  generateOrderCode,
  getSellerBalance,
  logOrderEvent,
  openDispute,
  releaseOrderPayout,
  signOrderAssets,
} from "./orders";
import { notifyMarket, orderUrl, formatClp } from "./notify";

const execFileAsync = promisify(execFile);

export const marketRouter = Router();

const storage = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${(config.apiUrl || "").replace(/\/$/, "")}/uploads`,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
});

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_MEDIA_MIMES = [...ALLOWED_IMAGE_MIMES, "video/mp4", "video/quicktime", "video/webm"];

const PRODUCT_TYPES: MarketProductType[] = ["PHOTO_SET", "VIDEO", "CLOTHING", "FETISH", "CUSTOM", "OTHER"];
const DELIVERY_METHODS: MarketDeliveryMethod[] = ["DIGITAL", "MEET", "SHIPPING"];

/** Los tipos digitales se pueden entregar automáticamente dentro del ecosistema. */
const DIGITAL_TYPES = new Set<MarketProductType>(["PHOTO_SET", "VIDEO"]);

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { error: "RATE_LIMIT", message: "Demasiadas solicitudes. Intenta en un minuto." },
});

const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { error: "RATE_LIMIT", message: "Demasiadas acciones. Intenta en un minuto." },
});

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { error: "RATE_LIMIT", message: "Demasiados mensajes. Espera un momento." },
});

/* ══════════════════════════ Helpers ══════════════════════════ */

function userId(req: any): string {
  return req.user?.id || req.session?.userId;
}

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function str(value: unknown, max = 500): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.slice(0, max);
}

const publicProfile = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  city: true,
  isVerified: true,
  profileType: true,
} as const;

/** Extrae el primer frame de un video para usarlo de miniatura. */
async function extractVideoThumbnail(
  videoBuffer: Buffer,
  originalFilename: string,
  opts: { privateAsset?: boolean } = {},
): Promise<string | null> {
  try {
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "market-thumb-"));
    const tmpVideo = path.join(tmpDir, "input" + path.extname(originalFilename));
    const tmpThumb = path.join(tmpDir, "thumb.jpg");
    await fsp.writeFile(tmpVideo, videoBuffer);
    await execFileAsync("ffmpeg", ["-i", tmpVideo, "-vframes", "1", "-ss", "0.5", "-vf", "scale=640:-2", "-q:v", "8", tmpThumb], {
      timeout: 15000,
    });
    const thumbBuffer = await fsp.readFile(tmpThumb);
    const saved = opts.privateAsset
      ? await savePrivate({ buffer: thumbBuffer, originalName: "thumb.jpg", mimeType: "image/jpeg", folder: MARKET_ASSET_FOLDER })
      : await storage.save({ buffer: thumbBuffer, filename: "thumb.jpg", mimeType: "image/jpeg", folder: "market-previews" });
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    return saved.url;
  } catch {
    return null;
  }
}

/** Ficha pública del artículo (nunca incluye los archivos privados). */
function productCard(product: any) {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    priceClp: product.priceClp,
    type: product.type,
    deliveryMethods: product.deliveryMethods,
    autoDeliver: product.autoDeliver,
    stock: product.stock,
    isActive: product.isActive,
    tags: product.tags,
    coverUrl: product.coverUrl,
    salesCount: product.salesCount,
    viewCount: product.viewCount,
    ratingAvg: product.ratingAvg,
    ratingCount: product.ratingCount,
    createdAt: product.createdAt,
    assetCount: product._count?.assets ?? undefined,
    media: (product.media || []).map((m: any) => ({ id: m.id, url: m.url, thumbnailUrl: m.thumbnailUrl, type: m.type, pos: m.pos })),
    seller: product.user
      ? {
          id: product.user.id,
          username: product.user.username,
          displayName: product.user.displayName,
          avatarUrl: product.user.avatarUrl,
          city: product.user.city,
          isVerified: product.user.isVerified,
          storeName: product.seller?.storeName || null,
          tagline: product.seller?.tagline || null,
        }
      : null,
  };
}

function orderCard(order: any, viewer: "buyer" | "seller" | "admin") {
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    payoutStatus: order.payoutStatus,
    productId: order.productId,
    productTitle: order.productTitle,
    unitPriceClp: order.unitPriceClp,
    quantity: order.quantity,
    itemTotalClp: order.itemTotalClp,
    shippingClp: order.shippingClp,
    totalClp: order.totalClp,
    commissionClp: viewer === "buyer" ? undefined : order.commissionClp,
    sellerNetClp: viewer === "buyer" ? undefined : order.sellerNetClp,
    commissionPercent: viewer === "buyer" ? undefined : order.commissionPercent,
    deliveryMethod: order.deliveryMethod,
    shippingRegion: order.shippingRegion,
    shipAddress: order.shipAddress,
    shipCity: order.shipCity,
    shipName: order.shipName,
    shipPhone: order.shipPhone,
    shipNotes: order.shipNotes,
    trackingCode: order.trackingCode,
    paymentMethod: order.paymentMethod,
    transferReceiptUrl: viewer === "buyer" || viewer === "admin" ? order.transferReceiptUrl : undefined,
    paidAt: order.paidAt,
    autoReleaseAt: order.autoReleaseAt,
    deliveredAt: order.deliveredAt,
    buyerConfirmedAt: order.buyerConfirmedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    cancelReason: order.cancelReason,
    autoDelivered: order.autoDelivered,
    disputedAt: order.disputedAt,
    disputeReason: order.disputeReason,
    disputeResolution: order.disputeResolution,
    createdAt: order.createdAt,
    assetCount: order._count?.assets ?? (order.assets?.length ?? 0),
    product: order.product ? { id: order.product.id, coverUrl: order.product.coverUrl, type: order.product.type } : null,
    buyer: order.buyer
      ? { id: order.buyer.id, username: order.buyer.username, displayName: order.buyer.displayName, avatarUrl: order.buyer.avatarUrl }
      : null,
    seller: order.seller
      ? { id: order.seller.id, username: order.seller.username, displayName: order.seller.displayName, avatarUrl: order.seller.avatarUrl }
      : null,
  };
}

/** La vendedora tiene que ser profesional y no estar bloqueada. */
async function requireSeller(req: any, res: any) {
  const id = userId(req);
  const seller = await prisma.marketSeller.findUnique({ where: { userId: id } });
  if (!seller) {
    res.status(404).json({ error: "SELLER_NOT_FOUND", message: "Aún no abriste tu tienda en el marketplace." });
    return null;
  }
  if (seller.isBanned) {
    res.status(403).json({ error: "SELLER_BANNED", message: "Tu tienda está suspendida. Escríbenos para revisarlo." });
    return null;
  }
  return seller;
}

/* ══════════════════════ Público — catálogo ══════════════════════ */

/** GET /market/config — reglas visibles del marketplace y tarifas de envío. */
marketRouter.get("/market/config", asyncHandler(async (_req, res) => {
  const [settings, rates] = await Promise.all([
    getMarketSettings(),
    prisma.marketShippingRate.findMany({ where: { isActive: true }, orderBy: { region: "asc" } }),
  ]);
  return res.json({
    isEnabled: settings.isEnabled,
    commissionPercent: settings.commissionPercent,
    holdDays: settings.holdDays,
    minPriceClp: settings.minPriceClp,
    maxPriceClp: settings.maxPriceClp,
    gatewayEnabled: settings.gatewayEnabled,
    transferEnabled: settings.transferEnabled && transferDataComplete(settings),
    shippingRates: rates.map((r) => ({ id: r.id, region: r.region, priceClp: r.priceClp, etaText: r.etaText })),
  });
}));

/** GET /market/products — catálogo público con filtros. */
marketRouter.get("/market/products", asyncHandler(async (req, res) => {
  const q = str(req.query.q, 80);
  const type = String(req.query.type || "").toUpperCase();
  const sellerUsername = str(req.query.seller, 80);
  const sort = String(req.query.sort || "recent");
  const take = Math.min(60, Math.max(1, toInt(req.query.limit, 24)));
  const skip = Math.max(0, toInt(req.query.offset, 0));
  const minPrice = req.query.minPrice !== undefined ? toInt(req.query.minPrice, 0) : null;
  const maxPrice = req.query.maxPrice !== undefined ? toInt(req.query.maxPrice, 0) : null;

  const where: Prisma.MarketProductWhereInput = {
    isActive: true,
    isHidden: false,
    seller: { isActive: true, isBanned: false },
    ...(PRODUCT_TYPES.includes(type as MarketProductType) ? { type: type as MarketProductType } : {}),
    ...(sellerUsername ? { user: { username: sellerUsername } } : {}),
    ...(minPrice !== null || maxPrice !== null
      ? { priceClp: { ...(minPrice !== null ? { gte: minPrice } : {}), ...(maxPrice !== null ? { lte: maxPrice } : {}) } }
      : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { tags: { has: q.toLowerCase() } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.MarketProductOrderByWithRelationInput =
    sort === "price_asc" ? { priceClp: "asc" }
    : sort === "price_desc" ? { priceClp: "desc" }
    : sort === "popular" ? { salesCount: "desc" }
    : { createdAt: "desc" };

  const [products, total] = await Promise.all([
    prisma.marketProduct.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        media: { orderBy: { pos: "asc" }, take: 4 },
        user: { select: publicProfile },
        seller: { select: { storeName: true, tagline: true } },
        _count: { select: { assets: true } },
      },
    }),
    prisma.marketProduct.count({ where }),
  ]);

  return res.json({ products: products.map(productCard), total, hasMore: skip + products.length < total });
}));

/** GET /market/products/:id — detalle público del artículo. */
marketRouter.get("/market/products/:id", asyncHandler(async (req, res) => {
  const product = await prisma.marketProduct.findUnique({
    where: { id: String(req.params.id) },
    include: {
      media: { orderBy: { pos: "asc" } },
      user: { select: publicProfile },
      seller: true,
      _count: { select: { assets: true } },
    },
  });
  if (!product || product.isHidden) return res.status(404).json({ error: "NOT_FOUND" });

  const viewer = userId(req as any);
  const isOwner = viewer && viewer === product.userId;
  if (!product.isActive && !isOwner) return res.status(404).json({ error: "NOT_FOUND" });

  if (!isOwner) {
    await prisma.marketProduct.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined);
  }

  const reviews = await prisma.marketReview.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { buyer: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });

  const settings = await getMarketSettings();

  return res.json({
    product: productCard(product),
    seller: {
      id: product.user.id,
      username: product.user.username,
      displayName: product.user.displayName,
      avatarUrl: product.user.avatarUrl,
      city: product.user.city,
      isVerified: product.user.isVerified,
      storeName: product.seller.storeName,
      tagline: product.seller.tagline,
      bio: product.seller.bio,
      region: product.seller.region,
      totalSales: product.seller.totalSales,
      acceptsShipping: product.seller.acceptsShipping,
      acceptsMeet: product.seller.acceptsMeet,
    },
    reviews: reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      buyer: { username: r.buyer.username, displayName: r.buyer.displayName, avatarUrl: r.buyer.avatarUrl },
    })),
    holdDays: settings.holdDays,
  });
}));

/** GET /market/sellers — tiendas activas del marketplace. */
marketRouter.get("/market/sellers", asyncHandler(async (req, res) => {
  const take = Math.min(48, Math.max(1, toInt(req.query.limit, 18)));
  const sellers = await prisma.marketSeller.findMany({
    where: { isActive: true, isBanned: false, products: { some: { isActive: true, isHidden: false } } },
    orderBy: [{ totalSales: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      user: { select: publicProfile },
      _count: { select: { products: true } },
    },
  });

  return res.json({
    sellers: sellers.map((s) => ({
      id: s.id,
      storeName: s.storeName,
      tagline: s.tagline,
      region: s.region,
      totalSales: s.totalSales,
      productCount: s._count.products,
      user: {
        id: s.user.id,
        username: s.user.username,
        displayName: s.user.displayName,
        avatarUrl: s.user.avatarUrl,
        city: s.user.city,
        isVerified: s.user.isVerified,
      },
    })),
  });
}));

/** GET /market/sellers/:username — vitrina de una vendedora. */
marketRouter.get("/market/sellers/:username", asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: String(req.params.username) },
    select: { ...publicProfile, bio: true, marketSeller: true },
  });
  if (!user?.marketSeller || user.marketSeller.isBanned || !user.marketSeller.isActive) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const products = await prisma.marketProduct.findMany({
    where: { userId: user.id, isActive: true, isHidden: false },
    orderBy: { createdAt: "desc" },
    take: 60,
    include: {
      media: { orderBy: { pos: "asc" }, take: 3 },
      user: { select: publicProfile },
      seller: { select: { storeName: true, tagline: true } },
      _count: { select: { assets: true } },
    },
  });

  return res.json({
    seller: {
      id: user.marketSeller.id,
      storeName: user.marketSeller.storeName,
      tagline: user.marketSeller.tagline,
      bio: user.marketSeller.bio || user.bio,
      region: user.marketSeller.region,
      totalSales: user.marketSeller.totalSales,
      acceptsShipping: user.marketSeller.acceptsShipping,
      acceptsMeet: user.marketSeller.acceptsMeet,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        city: user.city,
        isVerified: user.isVerified,
      },
    },
    products: products.map(productCard),
  });
}));

/* ══════════════ Contenido comprado (URL firmada) ══════════════
   La firma HMAC de vida corta es la autorización: así el <img> o el <video>
   cargan sin cookies y el enlace deja de servir a los 15 minutos. */

async function handleOrderAsset(req: any, res: any, kind: "asset" | "thumb") {
  const id = String(req.params.assetId || "");
  const exp = parseInt(String(req.query.exp || ""), 10);
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  if (!id || !exp || !sig) return res.status(400).json({ error: "BAD_SIGNATURE" });
  if (!verifyOrderAssetSignature(id, kind, exp, sig)) return res.status(403).json({ error: "BAD_SIGNATURE" });

  const asset = await prisma.marketOrderAsset.findUnique({ where: { id }, select: { url: true, thumbnailUrl: true } });
  if (!asset) return res.status(404).json({ error: "NOT_FOUND" });

  const source = kind === "thumb" ? asset.thumbnailUrl : asset.url;
  if (!source) return res.status(404).json({ error: "NOT_FOUND" });
  if (!isPrivateRef(source)) return res.redirect(source);

  const relPath = privateRefToRelPath(source);
  if (!relPath) return res.status(404).json({ error: "NOT_FOUND" });
  await streamOrderAsset(relPath, req, res);
}

marketRouter.get("/market/media/:assetId", asyncHandler((req, res) => handleOrderAsset(req, res, "asset")));
marketRouter.head("/market/media/:assetId", asyncHandler((req, res) => handleOrderAsset(req, res, "asset")));
marketRouter.get("/market/media/:assetId/thumb", asyncHandler((req, res) => handleOrderAsset(req, res, "thumb")));
marketRouter.head("/market/media/:assetId/thumb", asyncHandler((req, res) => handleOrderAsset(req, res, "thumb")));

/* ══════════════════════ Compradora — pedidos ══════════════════════ */

/** Arma el link de pago de la pasarela para un pedido pendiente. */
async function createGatewayPayment(order: {
  id: string;
  code: string;
  totalClp: number;
  productTitle: string;
  buyerId: string;
}, buyerEmail: string) {
  const apiUrl = (config.apiUrl || "").replace(/\/$/, "");
  const appUrl = (config.appUrl || "").replace(/\/$/, "");

  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: order.buyerId,
      purpose: "MARKETPLACE_ORDER",
      method: "FLOW",
      status: "PENDING",
      amount: order.totalClp,
      notes: JSON.stringify({ marketOrderId: order.id, code: order.code }),
    },
  });

  const payment = await createFlowPayment({
    commerceOrder: intent.id,
    subject: `Marketplace UZEED — ${order.productTitle}`.slice(0, 80),
    currency: "CLP",
    amount: order.totalClp,
    email: buyerEmail,
    urlConfirmation: `${apiUrl}/webhooks/flow/payment`,
    urlReturn: `${appUrl}/marketplace/compras/${order.id}?pago=retorno`,
    optional: JSON.stringify({ marketOrderId: order.id }),
  });

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerPaymentId: payment.token, paymentUrl: `${payment.url}?token=${payment.token}` },
  });

  await prisma.marketOrder.update({ where: { id: order.id }, data: { paymentIntentId: intent.id, paymentMethod: "FLOW" } });

  return { intentId: intent.id, paymentUrl: `${payment.url}?token=${payment.token}` };
}

/** POST /market/orders — la clienta genera el pedido y elige cómo pagar. */
marketRouter.post("/market/orders", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const settings = await getMarketSettings();
  if (!settings.isEnabled) return res.status(503).json({ error: "MARKET_DISABLED", message: "El marketplace está en mantención." });

  const productId = str(req.body?.productId, 64);
  if (!productId) return res.status(400).json({ error: "PRODUCT_REQUIRED" });

  const quantity = Math.max(1, Math.min(20, toInt(req.body?.quantity, 1)));
  const deliveryMethod = String(req.body?.deliveryMethod || "DIGITAL").toUpperCase() as MarketDeliveryMethod;
  if (!DELIVERY_METHODS.includes(deliveryMethod)) return res.status(400).json({ error: "DELIVERY_METHOD_INVALID" });

  const paymentMethod = String(req.body?.paymentMethod || "FLOW").toUpperCase();
  if (paymentMethod !== "FLOW" && paymentMethod !== "TRANSFER") return res.status(400).json({ error: "PAYMENT_METHOD_INVALID" });
  if (paymentMethod === "FLOW" && !settings.gatewayEnabled) return res.status(400).json({ error: "GATEWAY_DISABLED" });
  if (paymentMethod === "TRANSFER" && !(settings.transferEnabled && transferDataComplete(settings))) {
    return res.status(400).json({ error: "TRANSFER_DISABLED" });
  }

  const product = await prisma.marketProduct.findUnique({
    where: { id: productId },
    include: { seller: true, user: { select: { id: true, displayName: true, username: true, email: true } }, _count: { select: { assets: true } } },
  });
  if (!product || !product.isActive || product.isHidden) return res.status(404).json({ error: "PRODUCT_NOT_FOUND" });
  if (product.seller.isBanned || !product.seller.isActive) return res.status(404).json({ error: "SELLER_UNAVAILABLE" });
  if (product.userId === buyerId) return res.status(400).json({ error: "OWN_PRODUCT", message: "No puedes comprar tu propio artículo." });
  if (!product.deliveryMethods.includes(deliveryMethod)) {
    return res.status(400).json({ error: "DELIVERY_NOT_SUPPORTED", message: "Esa forma de entrega no está disponible para este artículo." });
  }
  if (product.stock !== null && product.stock < quantity) {
    return res.status(400).json({ error: "INSUFFICIENT_STOCK", available: product.stock });
  }
  if (deliveryMethod === "DIGITAL" && product._count.assets === 0) {
    return res.status(400).json({ error: "NO_ASSETS", message: "La vendedora todavía no cargó el contenido de este artículo." });
  }

  // Envío: la tarifa la fija el admin por región y no paga comisión.
  let shippingClp = 0;
  let shippingRateId: string | null = null;
  let shippingRegion: string | null = null;
  if (deliveryMethod === "SHIPPING") {
    shippingRegion = str(req.body?.shippingRegion, 80);
    if (!shippingRegion) return res.status(400).json({ error: "REGION_REQUIRED" });
    const rate = await prisma.marketShippingRate.findFirst({ where: { region: shippingRegion, isActive: true } });
    if (!rate) return res.status(400).json({ error: "REGION_NOT_AVAILABLE", message: "No hay envío configurado para esa región." });
    shippingClp = rate.priceClp;
    shippingRateId = rate.id;
  }

  const shipAddress = deliveryMethod === "SHIPPING" ? str(req.body?.shipAddress, 300) : null;
  const shipName = deliveryMethod === "SHIPPING" ? str(req.body?.shipName, 120) : null;
  const shipPhone = deliveryMethod === "SHIPPING" ? str(req.body?.shipPhone, 40) : null;
  const shipCity = deliveryMethod === "SHIPPING" ? str(req.body?.shipCity, 120) : null;
  const shipNotes = str(req.body?.shipNotes, 500);
  if (deliveryMethod === "SHIPPING" && (!shipAddress || !shipName || !shipPhone)) {
    return res.status(400).json({ error: "SHIPPING_DATA_REQUIRED", message: "Necesitamos nombre, teléfono y dirección para el envío." });
  }

  const itemTotalClp = product.priceClp * quantity;
  const { commissionClp, sellerNetClp, totalClp } = splitAmounts(itemTotalClp, shippingClp, settings.commissionPercent);

  const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { email: true, displayName: true, username: true } });
  if (!buyer) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const order = await prisma.marketOrder.create({
    data: {
      code: generateOrderCode(),
      buyerId,
      sellerId: product.userId,
      productId: product.id,
      productTitle: product.title,
      unitPriceClp: product.priceClp,
      quantity,
      itemTotalClp,
      shippingClp,
      totalClp,
      commissionClp,
      sellerNetClp,
      commissionPercent: settings.commissionPercent,
      deliveryMethod,
      shippingRateId,
      shippingRegion,
      shipAddress,
      shipCity,
      shipName,
      shipPhone,
      shipNotes,
      paymentMethod: paymentMethod === "TRANSFER" ? "TRANSFER" : "FLOW",
      status: "PENDING_PAYMENT",
    },
  });

  await logOrderEvent(order.id, "ORDER_CREATED", {
    actorId: buyerId,
    note: `Pedido creado (${deliveryMethod}, ${paymentMethod})`,
    data: { totalClp, shippingClp, commissionClp },
  });

  if (paymentMethod === "TRANSFER") {
    await sendMarketTransferInstructionsEmail(buyer.email, {
      name: buyer.displayName || buyer.username,
      code: order.code,
      amountClp: order.totalClp,
      bank: publicTransferData(settings),
    }).catch(() => undefined);

    return res.json({
      order: orderCard(order, "buyer"),
      paymentMethod: "TRANSFER",
      transferData: publicTransferData(settings),
    });
  }

  try {
    const gateway = await createGatewayPayment(
      { id: order.id, code: order.code, totalClp: order.totalClp, productTitle: order.productTitle, buyerId },
      buyer.email,
    );
    return res.json({ order: orderCard(order, "buyer"), paymentMethod: "FLOW", paymentUrl: gateway.paymentUrl });
  } catch (err: any) {
    console.error("[market] flow payment creation failed", { orderId: order.id, error: err?.message || err });
    return res.status(502).json({
      error: "PAYMENT_GATEWAY_ERROR",
      message: "No pudimos abrir la pasarela de pago. Intenta de nuevo o paga por transferencia.",
      orderId: order.id,
    });
  }
}));

/** POST /market/orders/:id/pay — reintentar el pago de un pedido pendiente. */
marketRouter.post("/market/orders/:id/pay", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || order.buyerId !== buyerId) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status !== "PENDING_PAYMENT") return res.status(400).json({ error: "NOT_PENDING" });

  const settings = await getMarketSettings();
  const method = String(req.body?.paymentMethod || order.paymentMethod).toUpperCase();

  if (method === "TRANSFER") {
    if (!(settings.transferEnabled && transferDataComplete(settings))) return res.status(400).json({ error: "TRANSFER_DISABLED" });
    await prisma.marketOrder.update({ where: { id: order.id }, data: { paymentMethod: "TRANSFER" } });
    return res.json({ paymentMethod: "TRANSFER", transferData: publicTransferData(settings) });
  }

  if (!settings.gatewayEnabled) return res.status(400).json({ error: "GATEWAY_DISABLED" });
  const buyer = await prisma.user.findUnique({ where: { id: buyerId }, select: { email: true } });
  const gateway = await createGatewayPayment(
    { id: order.id, code: order.code, totalClp: order.totalClp, productTitle: order.productTitle, buyerId },
    buyer?.email || "",
  );
  return res.json({ paymentMethod: "FLOW", paymentUrl: gateway.paymentUrl });
}));

/** POST /market/orders/:id/receipt — comprobante de la transferencia. */
marketRouter.post("/market/orders/:id/receipt", requireAuth, orderLimiter, upload.single("file"), asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || order.buyerId !== buyerId) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_REVIEW") return res.status(400).json({ error: "NOT_PENDING" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "FILE_REQUIRED" });
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype) && file.mimetype !== "application/pdf") {
    return res.status(400).json({ error: "INVALID_FILE_TYPE", message: "Sube una imagen o un PDF del comprobante." });
  }

  const saved = await storage.save({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    folder: "market-receipts",
  });

  const updated = await prisma.marketOrder.update({
    where: { id: order.id },
    data: {
      transferReceiptUrl: saved.url,
      transferNote: str(req.body?.note, 300),
      paymentMethod: "TRANSFER",
      status: "PAYMENT_REVIEW",
    },
  });

  await logOrderEvent(order.id, "TRANSFER_RECEIPT_UPLOADED", { actorId: buyerId });

  return res.json({ order: orderCard(updated, "buyer") });
}));

/** GET /market/orders — mis compras. */
marketRouter.get("/market/orders", requireAuth, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const orders = await prisma.marketOrder.findMany({
    where: { buyerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      product: { select: { id: true, coverUrl: true, type: true } },
      seller: { select: publicProfile },
      _count: { select: { assets: true } },
    },
  });
  return res.json({ orders: orders.map((o) => orderCard(o, "buyer")) });
}));

/** GET /market/orders/:id — detalle de la compra, con el contenido firmado. */
marketRouter.get("/market/orders/:id", requireAuth, asyncHandler(async (req, res) => {
  const viewerId = userId(req);
  const order = await prisma.marketOrder.findUnique({
    where: { id: String(req.params.id) },
    include: {
      product: { select: { id: true, coverUrl: true, type: true } },
      buyer: { select: publicProfile },
      seller: { select: publicProfile },
      assets: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      review: true,
    },
  });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  const isBuyer = order.buyerId === viewerId;
  const isSeller = order.sellerId === viewerId;
  if (!isBuyer && !isSeller) return res.status(403).json({ error: "FORBIDDEN" });

  const settings = await getMarketSettings();
  const paidStates = ["PAID", "PREPARING", "DELIVERED", "COMPLETED"];
  const canSeeAssets = isBuyer && paidStates.includes(order.status);

  if (canSeeAssets && order.assets.some((a) => !a.viewedAt)) {
    await prisma.marketOrderAsset.updateMany({
      where: { orderId: order.id, viewedAt: null },
      data: { viewedAt: new Date() },
    }).catch(() => undefined);
  }

  return res.json({
    order: orderCard(order, isBuyer ? "buyer" : "seller"),
    assets: canSeeAssets ? signOrderAssets(order.assets) : [],
    events: order.events.map((e) => ({ id: e.id, type: e.type, note: e.note, createdAt: e.createdAt })),
    review: order.review,
    holdDays: settings.holdDays,
    transferData: order.paymentMethod === "TRANSFER" && isBuyer && ["PENDING_PAYMENT", "PAYMENT_REVIEW"].includes(order.status)
      ? publicTransferData(settings)
      : null,
  });
}));

/** GET /market/orders/:id/assets — refresca las URLs firmadas al caducar. */
marketRouter.get("/market/orders/:id/assets", requireAuth, asyncHandler(async (req, res) => {
  const viewerId = userId(req);
  const order = await prisma.marketOrder.findUnique({
    where: { id: String(req.params.id) },
    select: { buyerId: true, status: true, assets: { orderBy: { createdAt: "asc" } } },
  });
  if (!order || order.buyerId !== viewerId) return res.status(404).json({ error: "NOT_FOUND" });
  if (!["PAID", "PREPARING", "DELIVERED", "COMPLETED"].includes(order.status)) {
    return res.status(403).json({ error: "NOT_PAID" });
  }
  return res.json({ assets: signOrderAssets(order.assets) });
}));

/** POST /market/orders/:id/confirm — "lo recibí": libera el pago. */
marketRouter.post("/market/orders/:id/confirm", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || order.buyerId !== buyerId) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status === "DISPUTED") {
    return res.status(400).json({
      error: "DISPUTE_OPEN",
      message: "Tienes un reclamo abierto en este pedido. Lo resuelve administración.",
    });
  }
  if (!["PAID", "PREPARING", "DELIVERED"].includes(order.status)) return res.status(400).json({ error: "INVALID_STATE" });

  const updated = await releaseOrderPayout(order.id, "buyer_confirmed");
  await logOrderEvent(order.id, "BUYER_CONFIRMED", { actorId: buyerId, note: "La clienta confirmó la recepción" });
  return res.json({ order: orderCard(updated, "buyer") });
}));

/** POST /market/orders/:id/dispute — "no me llegó": abre un reclamo.
 *  El dinero sigue retenido y deja de tener fecha de liberación automática. */
marketRouter.post("/market/orders/:id/dispute", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const reason = str(req.body?.reason, 1000);
  if (!reason) return res.status(400).json({ error: "REASON_REQUIRED", message: "Cuéntanos qué pasó con tu pedido." });

  const result = await openDispute(String(req.params.id), buyerId, reason);
  if ("error" in result) {
    if (result.error === "NOT_FOUND") return res.status(404).json({ error: "NOT_FOUND" });
    if (result.error === "ALREADY_RELEASED") {
      return res.status(400).json({
        error: "ALREADY_RELEASED",
        message: "El pago de este pedido ya se liberó. Escríbenos y lo revisamos con la vendedora.",
      });
    }
    return res.status(400).json({ error: "INVALID_STATE" });
  }

  return res.json({ order: orderCard(result.order, "buyer") });
}));

/** POST /market/orders/:id/cancel — cancelar antes de pagar. */
marketRouter.post("/market/orders/:id/cancel", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || order.buyerId !== buyerId) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status !== "PENDING_PAYMENT") {
    return res.status(400).json({ error: "INVALID_STATE", message: "Solo puedes cancelar un pedido que aún no pagaste." });
  }

  const updated = await prisma.marketOrder.update({
    where: { id: order.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Cancelado por la clienta", payoutStatus: "CANCELLED" },
  });
  await logOrderEvent(order.id, "ORDER_CANCELLED", { actorId: buyerId });
  return res.json({ order: orderCard(updated, "buyer") });
}));

/** POST /market/orders/:id/review — reseña tras completar la compra. */
marketRouter.post("/market/orders/:id/review", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const buyerId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) }, include: { review: true } });
  if (!order || order.buyerId !== buyerId) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status !== "COMPLETED") return res.status(400).json({ error: "NOT_COMPLETED" });
  if (order.review) return res.status(400).json({ error: "ALREADY_REVIEWED" });
  if (!order.productId) return res.status(400).json({ error: "PRODUCT_REMOVED" });

  const rating = Math.max(1, Math.min(5, toInt(req.body?.rating, 5)));
  const comment = str(req.body?.comment, 600);

  const review = await prisma.marketReview.create({
    data: { orderId: order.id, productId: order.productId, buyerId, rating, comment },
  });

  const agg = await prisma.marketReview.aggregate({
    where: { productId: order.productId },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.marketProduct.update({
    where: { id: order.productId },
    data: { ratingAvg: agg._avg.rating, ratingCount: agg._count.rating },
  });

  return res.json({ review });
}));

/* ══════════════════ Chat del pedido (comprador ↔ vendedora) ══════════════════
   Cuando la entrega se acuerda en persona, este es el canal donde se coordina.
   El equipo de administración puede leerlo desde el panel. */

async function loadOrderForParticipant(orderId: string, viewerId: string) {
  const order = await prisma.marketOrder.findUnique({
    where: { id: orderId },
    select: { id: true, code: true, buyerId: true, sellerId: true, productTitle: true },
  });
  if (!order) return null;
  if (order.buyerId !== viewerId && order.sellerId !== viewerId) return null;
  return order;
}

marketRouter.get("/market/orders/:id/messages", requireAuth, asyncHandler(async (req, res) => {
  const viewerId = userId(req);
  const order = await loadOrderForParticipant(String(req.params.id), viewerId);
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  const messages = await prisma.marketOrderMessage.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: "asc" },
    take: 300,
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });

  await prisma.marketOrderMessage.updateMany({
    where: { orderId: order.id, senderId: { not: viewerId }, readAt: null },
    data: { readAt: new Date() },
  }).catch(() => undefined);

  return res.json({ messages });
}));

marketRouter.post("/market/orders/:id/messages", requireAuth, messageLimiter, asyncHandler(async (req, res) => {
  const senderId = userId(req);
  const order = await loadOrderForParticipant(String(req.params.id), senderId);
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  const body = str(req.body?.body, 2000);
  if (!body) return res.status(400).json({ error: "BODY_REQUIRED" });

  const message = await prisma.marketOrderMessage.create({
    data: { orderId: order.id, senderId, body },
    include: { sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
  });

  const recipientId = order.buyerId === senderId ? order.sellerId : order.buyerId;
  const senderName = message.sender.displayName || message.sender.username;
  await notifyMarket(recipientId, "MARKET_ORDER_MESSAGE", {
    title: `Mensaje de ${senderName}`,
    body: `Pedido ${order.code}: ${body.slice(0, 90)}`,
    url: orderUrl(order.id, recipientId === order.sellerId),
    orderId: order.id,
    orderCode: order.code,
  });

  return res.json({ message });
}));

/* ══════════════════════ Vendedora — tienda ══════════════════════ */

/** GET /market/seller/me — estado de mi tienda. */
marketRouter.get("/market/seller/me", requireAuth, asyncHandler(async (req, res) => {
  const id = userId(req);
  const [seller, settings] = await Promise.all([
    prisma.marketSeller.findUnique({ where: { userId: id }, include: { _count: { select: { products: true } } } }),
    getMarketSettings(),
  ]);
  const me = await prisma.user.findUnique({ where: { id }, select: { profileType: true, displayName: true, username: true } });

  return res.json({
    seller,
    canSell: me?.profileType === "PROFESSIONAL" || me?.profileType === "CREATOR",
    profileType: me?.profileType || null,
    commissionPercent: settings.commissionPercent,
    holdDays: settings.holdDays,
    minPriceClp: settings.minPriceClp,
    maxPriceClp: settings.maxPriceClp,
  });
}));

/** POST /market/seller/onboard — abrir la tienda. */
marketRouter.post("/market/seller/onboard", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const id = userId(req);
  const me = await prisma.user.findUnique({ where: { id }, select: { profileType: true, displayName: true, username: true } });
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (me.profileType !== "PROFESSIONAL" && me.profileType !== "CREATOR") {
    return res.status(403).json({
      error: "NOT_PROFESSIONAL",
      message: "El marketplace es para perfiles profesionales. Convierte tu cuenta para vender.",
    });
  }

  const data = {
    storeName: str(req.body?.storeName, 80) || me.displayName || me.username,
    tagline: str(req.body?.tagline, 140),
    bio: str(req.body?.bio, 1000),
    region: str(req.body?.region, 80),
    acceptsShipping: req.body?.acceptsShipping !== false,
    acceptsMeet: req.body?.acceptsMeet !== false,
    autoDeliverDigital: req.body?.autoDeliverDigital !== false,
  };

  const seller = await prisma.marketSeller.upsert({
    where: { userId: id },
    create: { userId: id, ...data },
    update: data,
  });

  return res.json({ seller });
}));

/** PUT /market/seller/bank — datos para recibir los pagos liberados. */
marketRouter.put("/market/seller/bank", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const updated = await prisma.marketSeller.update({
    where: { id: seller.id },
    data: {
      bankName: str(req.body?.bankName, 80),
      bankAccountType: str(req.body?.bankAccountType, 40),
      bankAccountNumber: str(req.body?.bankAccountNumber, 40),
      bankHolderName: str(req.body?.bankHolderName, 120),
      bankHolderRut: str(req.body?.bankHolderRut, 20),
      bankEmail: str(req.body?.bankEmail, 120),
    },
  });
  return res.json({ seller: updated });
}));

/** GET /market/seller/products — mis artículos (incluye los inactivos). */
marketRouter.get("/market/seller/products", requireAuth, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const products = await prisma.marketProduct.findMany({
    where: { sellerId: seller.id },
    orderBy: { createdAt: "desc" },
    include: {
      media: { orderBy: { pos: "asc" } },
      user: { select: publicProfile },
      seller: { select: { storeName: true, tagline: true } },
      _count: { select: { assets: true, orders: true } },
    },
  });

  return res.json({
    products: products.map((p) => ({
      ...productCard(p),
      isHidden: p.isHidden,
      orderCount: p._count.orders,
      assetCount: p._count.assets,
    })),
  });
}));

function parseDeliveryMethods(raw: unknown, type: MarketProductType): MarketDeliveryMethod[] {
  let list: string[] = [];
  if (Array.isArray(raw)) list = raw.map(String);
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map(String);
      else list = raw.split(",");
    } catch {
      list = raw.split(",");
    }
  }
  const cleaned = list
    .map((m) => m.trim().toUpperCase())
    .filter((m): m is MarketDeliveryMethod => DELIVERY_METHODS.includes(m as MarketDeliveryMethod));
  const unique = Array.from(new Set(cleaned));
  if (unique.length) return unique;
  return DIGITAL_TYPES.has(type) ? ["DIGITAL"] : ["MEET"];
}

function parseTags(raw: unknown): string[] {
  let list: string[] = [];
  if (Array.isArray(raw)) list = raw.map(String);
  else if (typeof raw === "string") list = raw.split(",");
  return Array.from(new Set(list.map((t) => t.trim().toLowerCase()).filter(Boolean))).slice(0, 12);
}

/** POST /market/seller/products — publicar un artículo. */
marketRouter.post("/market/seller/products", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  const settings = await getMarketSettings();

  const title = str(req.body?.title, 120);
  if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });

  const priceClp = toInt(req.body?.priceClp, 0);
  if (priceClp < settings.minPriceClp || priceClp > settings.maxPriceClp) {
    return res.status(400).json({
      error: "PRICE_OUT_OF_RANGE",
      message: `El precio debe estar entre ${formatClp(settings.minPriceClp)} y ${formatClp(settings.maxPriceClp)}.`,
    });
  }

  const typeRaw = String(req.body?.type || "PHOTO_SET").toUpperCase();
  const type = (PRODUCT_TYPES.includes(typeRaw as MarketProductType) ? typeRaw : "PHOTO_SET") as MarketProductType;
  const stockRaw = req.body?.stock;
  const stock = stockRaw === null || stockRaw === undefined || stockRaw === "" ? null : Math.max(0, toInt(stockRaw, 0));

  const product = await prisma.marketProduct.create({
    data: {
      sellerId: seller.id,
      userId: seller.userId,
      title,
      description: str(req.body?.description, 3000),
      priceClp,
      type,
      deliveryMethods: parseDeliveryMethods(req.body?.deliveryMethods, type),
      autoDeliver: req.body?.autoDeliver !== false && seller.autoDeliverDigital,
      stock: DIGITAL_TYPES.has(type) ? null : stock,
      tags: parseTags(req.body?.tags),
      isActive: req.body?.isActive !== false,
    },
    include: { media: true, user: { select: publicProfile }, seller: { select: { storeName: true, tagline: true } } },
  });

  return res.json({ product: productCard(product) });
}));

/** PATCH /market/seller/products/:id — editar un artículo. */
marketRouter.patch("/market/seller/products/:id", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  const settings = await getMarketSettings();

  const existing = await prisma.marketProduct.findUnique({ where: { id: String(req.params.id) } });
  if (!existing || existing.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  const data: Prisma.MarketProductUpdateInput = {};
  if (req.body?.title !== undefined) {
    const title = str(req.body.title, 120);
    if (!title) return res.status(400).json({ error: "TITLE_REQUIRED" });
    data.title = title;
  }
  if (req.body?.description !== undefined) data.description = str(req.body.description, 3000);
  if (req.body?.priceClp !== undefined) {
    const priceClp = toInt(req.body.priceClp, 0);
    if (priceClp < settings.minPriceClp || priceClp > settings.maxPriceClp) {
      return res.status(400).json({ error: "PRICE_OUT_OF_RANGE" });
    }
    data.priceClp = priceClp;
  }
  if (req.body?.type !== undefined) {
    const typeRaw = String(req.body.type).toUpperCase();
    if (PRODUCT_TYPES.includes(typeRaw as MarketProductType)) data.type = typeRaw as MarketProductType;
  }
  if (req.body?.deliveryMethods !== undefined) {
    data.deliveryMethods = parseDeliveryMethods(req.body.deliveryMethods, (data.type as MarketProductType) || existing.type);
  }
  if (req.body?.autoDeliver !== undefined) data.autoDeliver = Boolean(req.body.autoDeliver);
  if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  if (req.body?.tags !== undefined) data.tags = parseTags(req.body.tags);
  if (req.body?.stock !== undefined) {
    const stockRaw = req.body.stock;
    data.stock = stockRaw === null || stockRaw === "" ? null : Math.max(0, toInt(stockRaw, 0));
  }

  const product = await prisma.marketProduct.update({
    where: { id: existing.id },
    data,
    include: { media: { orderBy: { pos: "asc" } }, user: { select: publicProfile }, seller: { select: { storeName: true, tagline: true } }, _count: { select: { assets: true } } },
  });

  return res.json({ product: productCard(product) });
}));

/** DELETE /market/seller/products/:id — solo si nunca se vendió. */
marketRouter.delete("/market/seller/products/:id", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const existing = await prisma.marketProduct.findUnique({
    where: { id: String(req.params.id) },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing || existing.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  if (existing._count.orders > 0) {
    // Hay pedidos apuntando al artículo: se despublica en vez de borrarse para
    // no romper el historial de compras.
    const product = await prisma.marketProduct.update({ where: { id: existing.id }, data: { isActive: false } });
    return res.json({ product: { id: product.id, isActive: product.isActive }, archived: true });
  }

  await prisma.marketProduct.delete({ where: { id: existing.id } });
  return res.json({ ok: true, deleted: true });
}));

/** POST /market/seller/products/:id/media — fotos de vitrina (públicas). */
marketRouter.post("/market/seller/products/:id/media", requireAuth, contentLimiter, upload.array("files", 8), asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const product = await prisma.marketProduct.findUnique({ where: { id: String(req.params.id) } });
  if (!product || product.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) return res.status(400).json({ error: "NO_FILES" });
  for (const file of files) {
    if (!ALLOWED_MEDIA_MIMES.includes(file.mimetype)) {
      return res.status(400).json({ error: "INVALID_FILE_TYPE", message: `Tipo no permitido: ${file.mimetype}` });
    }
  }

  const lastPos = await prisma.marketProductMedia.aggregate({ where: { productId: product.id }, _max: { pos: true } });
  let pos = (lastPos._max.pos ?? -1) + 1;

  const created = [];
  for (const file of files) {
    const isVideo = file.mimetype.startsWith("video/");
    const saved = await storage.save({
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      folder: "market-previews",
    });
    const thumbnailUrl = isVideo ? await extractVideoThumbnail(file.buffer, file.originalname) : null;
    const media = await prisma.marketProductMedia.create({
      data: {
        productId: product.id,
        url: saved.url,
        thumbnailUrl,
        type: isVideo ? "VIDEO" : "IMAGE",
        pos: pos++,
      },
    });
    created.push(media);
  }

  if (!product.coverUrl && created.length) {
    await prisma.marketProduct.update({
      where: { id: product.id },
      data: { coverUrl: created[0].thumbnailUrl || created[0].url },
    });
  }

  return res.json({ media: created });
}));

marketRouter.delete("/market/seller/media/:mediaId", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const media = await prisma.marketProductMedia.findUnique({
    where: { id: String(req.params.mediaId) },
    include: { product: { select: { id: true, sellerId: true, coverUrl: true } } },
  });
  if (!media || media.product.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.marketProductMedia.delete({ where: { id: media.id } });

  if (media.product.coverUrl === media.url || media.product.coverUrl === media.thumbnailUrl) {
    const next = await prisma.marketProductMedia.findFirst({ where: { productId: media.product.id }, orderBy: { pos: "asc" } });
    await prisma.marketProduct.update({
      where: { id: media.product.id },
      data: { coverUrl: next ? next.thumbnailUrl || next.url : null },
    });
  }

  return res.json({ ok: true });
}));

/** POST /market/seller/products/:id/assets — el contenido que recibe quien compra.
 *  Se guarda en almacenamiento privado: nunca se sirve desde /uploads. */
marketRouter.post("/market/seller/products/:id/assets", requireAuth, contentLimiter, upload.array("files", 20), asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const product = await prisma.marketProduct.findUnique({ where: { id: String(req.params.id) } });
  if (!product || product.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  const files = (req.files as Express.Multer.File[]) || [];
  if (!files.length) return res.status(400).json({ error: "NO_FILES" });
  for (const file of files) {
    if (!ALLOWED_MEDIA_MIMES.includes(file.mimetype)) {
      return res.status(400).json({ error: "INVALID_FILE_TYPE", message: `Tipo no permitido: ${file.mimetype}` });
    }
  }

  const lastPos = await prisma.marketProductAsset.aggregate({ where: { productId: product.id }, _max: { pos: true } });
  let pos = (lastPos._max.pos ?? -1) + 1;

  const created = [];
  for (const file of files) {
    const isVideo = file.mimetype.startsWith("video/");
    const saved = await savePrivate({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder: MARKET_ASSET_FOLDER,
    });
    const thumbnailUrl = isVideo ? await extractVideoThumbnail(file.buffer, file.originalname, { privateAsset: true }) : null;
    const asset = await prisma.marketProductAsset.create({
      data: {
        productId: product.id,
        url: saved.url,
        thumbnailUrl,
        type: isVideo ? "VIDEO" : "IMAGE",
        sizeBytes: file.size,
        pos: pos++,
      },
    });
    created.push({ id: asset.id, type: asset.type, sizeBytes: asset.sizeBytes, pos: asset.pos, createdAt: asset.createdAt });
  }

  return res.json({ assets: created });
}));

/** GET /market/seller/products/:id/assets — listado (sin URLs: no se previsualizan). */
marketRouter.get("/market/seller/products/:id/assets", requireAuth, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const product = await prisma.marketProduct.findUnique({ where: { id: String(req.params.id) } });
  if (!product || product.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  const assets = await prisma.marketProductAsset.findMany({
    where: { productId: product.id },
    orderBy: { pos: "asc" },
    select: { id: true, type: true, sizeBytes: true, pos: true, createdAt: true },
  });
  return res.json({ assets });
}));

marketRouter.delete("/market/seller/assets/:assetId", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  const asset = await prisma.marketProductAsset.findUnique({
    where: { id: String(req.params.assetId) },
    include: { product: { select: { sellerId: true } } },
  });
  if (!asset || asset.product.sellerId !== seller.id) return res.status(404).json({ error: "NOT_FOUND" });

  // Las copias ya entregadas (MarketOrderAsset) conservan su propia URL, así
  // que borrar el archivo del catálogo no le quita nada a quien ya compró.
  await prisma.marketProductAsset.delete({ where: { id: asset.id } });
  return res.json({ ok: true });
}));

/* ══════════════════════ Vendedora — ventas ══════════════════════ */

/** GET /market/seller/orders — mis ventas. */
marketRouter.get("/market/seller/orders", requireAuth, asyncHandler(async (req, res) => {
  const sellerUserId = userId(req);
  const status = String(req.query.status || "").toUpperCase();

  const orders = await prisma.marketOrder.findMany({
    where: {
      sellerId: sellerUserId,
      ...(status && status !== "ALL" ? { status: status as any } : {}),
      // Un pedido sin pagar todavía no es una venta: no se le muestra.
      ...(status ? {} : { status: { notIn: ["PENDING_PAYMENT", "CANCELLED"] } }),
    },
    orderBy: { createdAt: "desc" },
    take: 150,
    include: {
      product: { select: { id: true, coverUrl: true, type: true } },
      buyer: { select: publicProfile },
      _count: { select: { assets: true } },
    },
  });

  return res.json({ orders: orders.map((o) => orderCard(o, "seller")) });
}));

/** POST /market/seller/orders/:id/accept — confirmar que se está preparando. */
marketRouter.post("/market/seller/orders/:id/accept", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const sellerUserId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || order.sellerId !== sellerUserId) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status !== "PAID") return res.status(400).json({ error: "INVALID_STATE" });

  const updated = await prisma.marketOrder.update({ where: { id: order.id }, data: { status: "PREPARING" } });
  await logOrderEvent(order.id, "SELLER_ACCEPTED", { actorId: sellerUserId });

  await notifyMarket(order.buyerId, "MARKET_ORDER_DELIVERED", {
    title: `Tu pedido ${order.code} está en preparación`,
    body: "La vendedora ya está preparando tu pedido.",
    url: orderUrl(order.id, false),
    orderId: order.id,
    orderCode: order.code,
  });

  return res.json({ order: orderCard(updated, "seller") });
}));

/** POST /market/seller/orders/:id/deliver — marcar entregado / enviado. */
marketRouter.post("/market/seller/orders/:id/deliver", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const sellerUserId = userId(req);
  const order = await prisma.marketOrder.findUnique({
    where: { id: String(req.params.id) },
    include: { buyer: { select: { email: true, displayName: true, username: true } } },
  });
  if (!order || order.sellerId !== sellerUserId) return res.status(404).json({ error: "NOT_FOUND" });
  if (!["PAID", "PREPARING"].includes(order.status)) return res.status(400).json({ error: "INVALID_STATE" });

  const trackingCode = str(req.body?.trackingCode, 80);
  const updated = await prisma.marketOrder.update({
    where: { id: order.id },
    data: { status: "DELIVERED", deliveredAt: new Date(), trackingCode: trackingCode ?? order.trackingCode },
  });
  await logOrderEvent(order.id, "SELLER_DELIVERED", { actorId: sellerUserId, note: trackingCode ? `Seguimiento ${trackingCode}` : null });

  const settings = await getMarketSettings();
  await notifyMarket(order.buyerId, "MARKET_ORDER_DELIVERED", {
    title: `Pedido ${order.code} entregado`,
    body: `Confirma que lo recibiste para liberar el pago. Si no, se libera solo a los ${settings.holdDays} días.`,
    url: orderUrl(order.id, false),
    orderId: order.id,
    orderCode: order.code,
  });
  await sendMarketOrderDeliveredEmail(order.buyer.email, {
    name: order.buyer.displayName || order.buyer.username,
    code: order.code,
    productTitle: order.productTitle,
    trackingCode,
    holdDays: settings.holdDays,
  }).catch(() => undefined);

  return res.json({ order: orderCard(updated, "seller") });
}));

/** POST /market/seller/orders/:id/send-assets — entrega manual del contenido.
 *  Sirve cuando la vendedora prefiere revisar antes de enviar en vez de usar
 *  la entrega automática. */
marketRouter.post("/market/seller/orders/:id/send-assets", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const sellerUserId = userId(req);
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order || order.sellerId !== sellerUserId) return res.status(404).json({ error: "NOT_FOUND" });
  if (!["PAID", "PREPARING"].includes(order.status)) return res.status(400).json({ error: "INVALID_STATE" });
  if (order.deliveryMethod !== "DIGITAL") {
    // Marcar entregado un pedido físico solo porque se subieron archivos daría
    // por cerrada una entrega que todavía no ocurrió.
    return res.status(400).json({ error: "NOT_DIGITAL", message: "Este pedido no es de entrega digital." });
  }

  const count = await deliverDigitalAssets(order.id);
  if (!count) return res.status(400).json({ error: "NO_ASSETS", message: "El artículo no tiene archivos cargados." });

  await logOrderEvent(order.id, "SELLER_SENT_ASSETS", { actorId: sellerUserId, note: `${count} archivo(s)` });
  await notifyMarket(order.buyerId, "MARKET_ORDER_DELIVERED", {
    title: `Tu contenido de ${order.code} está listo`,
    body: "Ya puedes verlo dentro de UZEED, en tus compras.",
    url: orderUrl(order.id, false),
    orderId: order.id,
    orderCode: order.code,
  });

  const updated = await prisma.marketOrder.findUnique({ where: { id: order.id } });
  return res.json({ order: orderCard(updated, "seller"), delivered: count });
}));

/** GET /market/seller/earnings — resumen de dinero y movimientos. */
marketRouter.get("/market/seller/earnings", requireAuth, asyncHandler(async (req, res) => {
  const sellerUserId = userId(req);
  const [balance, settings, ledger, withdrawals, counts] = await Promise.all([
    getSellerBalance(sellerUserId),
    getMarketSettings(),
    prisma.marketLedgerEntry.findMany({
      where: { userId: sellerUserId },
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { order: { select: { code: true, productTitle: true } } },
    }),
    prisma.marketWithdrawal.findMany({ where: { userId: sellerUserId }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.marketOrder.groupBy({ by: ["status"], where: { sellerId: sellerUserId }, _count: { _all: true } }),
  ]);

  return res.json({
    balance,
    commissionPercent: settings.commissionPercent,
    holdDays: settings.holdDays,
    ledger: ledger.map((l) => ({
      id: l.id,
      type: l.type,
      amountClp: l.amountClp,
      description: l.description,
      createdAt: l.createdAt,
      orderCode: l.order?.code || null,
      productTitle: l.order?.productTitle || null,
    })),
    withdrawals,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}));

/** POST /market/seller/withdrawals — pedir el retiro de lo liberado. */
marketRouter.post("/market/seller/withdrawals", requireAuth, orderLimiter, asyncHandler(async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;

  if (!seller.bankName || !seller.bankAccountNumber || !seller.bankHolderName) {
    return res.status(400).json({ error: "BANK_DATA_REQUIRED", message: "Carga tus datos bancarios antes de pedir un retiro." });
  }

  const balance = await getSellerBalance(seller.userId);
  const amountClp = toInt(req.body?.amountClp, 0);
  if (amountClp <= 0) return res.status(400).json({ error: "AMOUNT_INVALID" });
  if (amountClp > balance.availableClp) {
    return res.status(400).json({ error: "INSUFFICIENT_BALANCE", availableClp: balance.availableClp });
  }

  const withdrawal = await prisma.marketWithdrawal.create({
    data: {
      sellerId: seller.id,
      userId: seller.userId,
      amountClp,
      bankSnapshot: {
        bankName: seller.bankName,
        accountType: seller.bankAccountType,
        accountNumber: seller.bankAccountNumber,
        holderName: seller.bankHolderName,
        holderRut: seller.bankHolderRut,
        email: seller.bankEmail,
      },
    },
  });

  return res.json({ withdrawal, balance: await getSellerBalance(seller.userId) });
}));
