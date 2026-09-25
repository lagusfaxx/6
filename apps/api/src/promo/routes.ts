import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../auth/middleware";
import { createFlowPayment } from "../khipu/client";
import { getBillingSettings, withActivePlan } from "../lib/billingSettings";
import {
  applyPromoPurchase,
  checkPurchase,
  currentPlan,
  getActiveCatalog,
  getTokenRate,
  invalidateBoostCache,
  tokensFor,
} from "../lib/promo";
import { resolveProfessionalLevel } from "../lib/professionalLevel";
import { isUUID } from "../lib/validators";

export const promoRouter = Router();

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: { error: "TOO_MANY_REQUESTS", message: "Demasiados intentos. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /promo/catalog ── planes y boosts; con sesión incluye el estado propio
promoRouter.get(
  "/promo/catalog",
  asyncHandler(async (req, res) => {
    const userId: string | undefined = (req as any).user?.id;
    const [products, tokenRate, billing] = await Promise.all([getActiveCatalog(), getTokenRate(), getBillingSettings()]);

    let me: any = null;
    if (userId) {
      const now = new Date();
      const [user, boosts, wallet] = await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { profileType: true, tier: true, tierExpiresAt: true, membershipExpiresAt: true },
        }),
        prisma.profileBoost.findMany({
          where: { userId, endsAt: { gt: now } },
          orderBy: { startsAt: "asc" },
          select: { id: true, code: true, startsAt: true, endsAt: true, product: { select: { name: true } } },
        }),
        prisma.wallet.findUnique({ where: { userId }, select: { balance: true } }),
      ]);
      if (user) {
        const plan = currentPlan(user, now);
        me = {
          profileType: user.profileType,
          canBuy: user.profileType === "PROFESSIONAL",
          plan: plan ? { code: plan.code, manual: plan.manual, expiresAt: plan.expiresAt?.toISOString() ?? null } : null,
          membershipExpiresAt: user.membershipExpiresAt?.toISOString() ?? null,
          boosts: boosts.map((b) => ({
            id: b.id,
            code: b.code,
            name: b.product?.name ?? (b.code === "SPOTLIGHT" ? "Destacada" : "Subir al top"),
            startsAt: b.startsAt.toISOString(),
            endsAt: b.endsAt.toISOString(),
          })),
          walletBalance: wallet?.balance ?? 0,
        };
      }
    }

    return res.json({
      products: products.map((p) => ({
        id: p.id,
        kind: p.kind,
        code: p.code,
        name: p.name,
        description: p.description,
        duration: p.duration,
        priceClp: p.priceClp,
        tokens: tokensFor(p.priceClp, tokenRate),
      })),
      tokenRate,
      billingEnabled: billing.enabled,
      // Días de prueba gratis que recibe un perfil nuevo (los usa el registro).
      trialDays: billing.trialDays,
      flowAvailable: Boolean(config.flowApiKey),
      me,
    });
  })
);

// ── POST /promo/checkout ── { productId, method: "FLOW" | "TOKENS" }
promoRouter.post(
  "/promo/checkout",
  checkoutLimiter,
  asyncHandler(async (req, res) => {
    const userId: string | undefined = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const productId = String(req.body?.productId || "");
    const method = req.body?.method === "TOKENS" ? "TOKENS" : "FLOW";
    // Desde el registro se vuelve al estudio; desde /planes, a /planes.
    const returnTo = req.body?.returnTo === "studio" ? "/dashboard/services?bienvenida=1" : "/planes";

    const [user, product, billing] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          profileType: true,
          tier: true,
          tierExpiresAt: true,
          membershipExpiresAt: true,
        },
      }),
      isUUID(productId) ? prisma.promoProduct.findUnique({ where: { id: productId } }) : null,
      getBillingSettings(),
    ]);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!product) return res.status(404).json({ error: "PRODUCT_NOT_FOUND", message: "Producto no encontrado." });

    const check = checkPurchase(user, product, { billingEnabled: billing.enabled });
    if (!check.ok) return res.status(check.status).json({ error: check.error, message: check.message });

    const notes = JSON.stringify({ productId: product.id, code: product.code, kind: product.kind, name: product.name });

    if (method === "TOKENS") {
      const rate = await getTokenRate();
      const tokens = tokensFor(product.priceClp, rate);
      try {
        const result = await prisma.$transaction(async (tx) => {
          // Descuento condicional: si el saldo no alcanza, no se toca nada.
          const debited = await tx.wallet.updateMany({
            where: { userId, balance: { gte: tokens } },
            data: { balance: { decrement: tokens }, totalSpent: { increment: tokens } },
          });
          if (debited.count !== 1) throw new Error("INSUFFICIENT_TOKENS");
          const wallet = await tx.wallet.findUnique({ where: { userId } });
          const intent = await tx.paymentIntent.create({
            data: {
              subscriberId: userId,
              profileId: userId,
              purpose: "PROMO_PURCHASE",
              method: "TOKENS",
              status: "PAID",
              amount: product.priceClp,
              paidAt: new Date(),
              notes,
            },
          });
          await tx.tokenTransaction.create({
            data: {
              walletId: wallet!.id,
              type: "PROMO_PURCHASE",
              amount: -tokens,
              balance: wallet!.balance,
              referenceId: intent.id,
              description: `${product.name} (${product.kind === "PLAN" ? "plan" : "boost"})`,
            },
          });
          const applied = await applyPromoPurchase(tx, {
            userId,
            product,
            paidWith: "TOKENS",
            amountClp: product.priceClp,
            paymentIntentId: intent.id,
          });
          return { intentId: intent.id, balance: wallet!.balance, ...applied };
        });
        invalidateBoostCache();
        console.log("[promo] compra con tokens", { userId, product: product.code, tokens });
        return res.json({ ok: true, paid: true, intentId: result.intentId, summary: result.summary, walletBalance: result.balance });
      } catch (err: any) {
        if (err?.message === "INSUFFICIENT_TOKENS") {
          return res.status(402).json({
            error: "INSUFFICIENT_TOKENS",
            message: `Necesitas ${tokens} tokens y tu saldo no alcanza.`,
          });
        }
        throw err;
      }
    }

    // Flow
    if (!config.flowApiKey) {
      return res.status(503).json({ error: "PAYMENT_UNAVAILABLE", message: "El pago con Flow no está disponible." });
    }
    const email = (user.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED", message: "Tu cuenta necesita un correo para pagar." });

    const intent = await prisma.paymentIntent.create({
      data: {
        subscriberId: userId,
        profileId: userId,
        purpose: "PROMO_PURCHASE",
        method: "FLOW",
        status: "PENDING",
        amount: product.priceClp,
        notes,
      },
    });
    const appUrl = config.appUrl.replace(/\/$/, "");
    const apiUrl = config.apiUrl.replace(/\/$/, "");
    const payment = await createFlowPayment({
      commerceOrder: intent.id,
      subject: `UZEED — ${product.name}`,
      currency: "CLP",
      amount: product.priceClp,
      email,
      urlConfirmation: `${apiUrl}/webhooks/flow/payment`,
      urlReturn: `${appUrl}/pago/exitoso?ref=${intent.id}&next=${encodeURIComponent(returnTo)}`,
    });
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { paymentUrl: payment.url, providerPaymentId: payment.token },
    });
    return res.json({ ok: true, paid: false, url: `${payment.url}?token=${payment.token}`, intentId: intent.id });
  })
);

// ── GET /promo/history ── mis compras de planes y boosts
promoRouter.get(
  "/promo/history",
  asyncHandler(async (req, res) => {
    const userId: string | undefined = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const intents = await prisma.paymentIntent.findMany({
      where: { subscriberId: userId, purpose: "PROMO_PURCHASE", status: { in: ["PAID", "PENDING"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, status: true, method: true, amount: true, notes: true, createdAt: true, paidAt: true },
    });
    return res.json({
      history: intents.map((i) => {
        let name = "Compra";
        try {
          name = JSON.parse(i.notes || "{}").name || name;
        } catch {}
        return {
          id: i.id,
          name,
          status: i.status,
          method: i.method,
          amount: i.amount,
          createdAt: i.createdAt.toISOString(),
          paidAt: i.paidAt?.toISOString() ?? null,
        };
      }),
    });
  })
);

// ── GET /boosts/spotlight ── perfiles "Destacadas" para el inicio (público)
promoRouter.get(
  "/boosts/spotlight",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const limit = Math.min(24, Math.max(1, parseInt(String(req.query.limit || "12"), 10) || 12));
    const lat = req.query.lat !== undefined ? Number(req.query.lat) : null;
    const lng = req.query.lng !== undefined ? Number(req.query.lng) : null;

    const boosts = await prisma.profileBoost.findMany({
      where: { code: "SPOTLIGHT", startsAt: { lte: now }, endsAt: { gt: now } },
      select: { userId: true },
      distinct: ["userId"],
    });
    const ids = boosts.map((b) => b.userId);
    if (!ids.length) return res.json({ profiles: [] });

    const users = await prisma.user.findMany({
      where: withActivePlan({ id: { in: ids }, isActive: true, profileType: "PROFESSIONAL" as const }),
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        city: true,
        latitude: true,
        longitude: true,
        lastSeen: true,
        tier: true,
        baseRate: true,
        profileViews: true,
        completedServices: true,
        serviceCategory: true,
        profileTags: true,
      },
    });

    const toRad = (d: number) => (d * Math.PI) / 180;
    const dist = (la: number | null, lo: number | null) => {
      if (lat === null || lng === null || la === null || lo === null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
      const dLat = toRad(la - lat);
      const dLng = toRad(lo - lng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(la)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const profiles = users
      .map((u) => ({
        id: u.id,
        username: u.username,
        name: u.displayName || u.username,
        avatarUrl: u.avatarUrl,
        coverUrl: u.coverUrl,
        city: u.city,
        distance: dist(u.latitude, u.longitude),
        availableNow: u.lastSeen ? now.getTime() - u.lastSeen.getTime() <= 5 * 60 * 1000 : false,
        serviceCategory: u.serviceCategory,
        profileTags: u.profileTags ?? [],
        userLevel: resolveProfessionalLevel({
          baseRate: u.baseRate,
          profileViews: u.profileViews,
          lastSeen: u.lastSeen,
          completedServices: u.completedServices,
          adminTier: u.tier,
        }),
        boost: "SPOTLIGHT" as const,
      }))
      .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9))
      .slice(0, limit);

    return res.json({ profiles });
  })
);

/* ══════════════════════════════════════════════════════════════
   ADMIN: catálogo, regalos y resumen
   ══════════════════════════════════════════════════════════════ */

const PLAN_CODES = ["SILVER", "GOLD", "DIAMOND"] as const;
const BOOST_CODES = ["BUMP", "SPOTLIGHT"] as const;

promoRouter.get(
  "/admin/promo/products",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const products = await prisma.promoProduct.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
    return res.json({ products });
  })
);

promoRouter.put(
  "/admin/promo/products",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const list = Array.isArray(req.body?.products) ? req.body.products : null;
    if (!list) return res.status(400).json({ error: "VALIDATION", message: "Falta la lista de productos." });

    const clean: any[] = [];
    for (const [i, p] of list.entries()) {
      const kind = p.kind === "BOOST" ? "BOOST" : p.kind === "PLAN" ? "PLAN" : null;
      const code = String(p.code || "");
      const name = String(p.name || "").trim().slice(0, 60);
      const duration = Number(p.duration);
      const priceClp = Number(p.priceClp);
      const where = `Fila ${i + 1}`;
      if (!kind) return res.status(400).json({ error: "VALIDATION", message: `${where}: tipo inválido.` });
      const okCode = kind === "PLAN" ? (PLAN_CODES as readonly string[]).includes(code) : (BOOST_CODES as readonly string[]).includes(code);
      if (!okCode) return res.status(400).json({ error: "VALIDATION", message: `${where}: código inválido para ${kind}.` });
      if (!name) return res.status(400).json({ error: "VALIDATION", message: `${where}: falta el nombre.` });
      const maxDuration = kind === "PLAN" ? 365 : 24 * 60;
      if (!Number.isInteger(duration) || duration < 1 || duration > maxDuration) {
        return res.status(400).json({
          error: "VALIDATION",
          message: `${where}: la duración debe ser entre 1 y ${maxDuration} ${kind === "PLAN" ? "días" : "horas"}.`,
        });
      }
      if (!Number.isInteger(priceClp) || priceClp < 500 || priceClp > 2_000_000) {
        return res.status(400).json({ error: "VALIDATION", message: `${where}: el precio debe estar entre $500 y $2.000.000.` });
      }
      clean.push({
        id: p.id && isUUID(String(p.id)) ? String(p.id) : null,
        data: {
          kind,
          code,
          name,
          description: p.description ? String(p.description).trim().slice(0, 240) : null,
          duration,
          priceClp,
          isActive: p.isActive !== false,
          sortOrder: Number.isInteger(Number(p.sortOrder)) ? Number(p.sortOrder) : i * 10,
        },
      });
    }

    await prisma.$transaction(
      clean.map((c) =>
        c.id
          ? prisma.promoProduct.update({ where: { id: c.id }, data: c.data })
          : prisma.promoProduct.create({ data: c.data })
      )
    );
    // La tarifa de membresía (Silver) se relee al instante.
    await getBillingSettings(true);
    console.log("[promo] catálogo actualizado", { by: (req as any).user?.email, count: clean.length });
    const products = await prisma.promoProduct.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
    return res.json({ products });
  })
);

promoRouter.get(
  "/admin/promo/overview",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [boosts, plans, sales] = await Promise.all([
      prisma.profileBoost.findMany({
        where: { endsAt: { gt: now } },
        orderBy: { endsAt: "asc" },
        take: 100,
        select: {
          id: true,
          code: true,
          startsAt: true,
          endsAt: true,
          paidWith: true,
          product: { select: { name: true } },
          user: { select: { username: true, displayName: true } },
        },
      }),
      prisma.user.groupBy({
        by: ["tier"],
        where: { profileType: "PROFESSIONAL", tier: { not: null }, tierExpiresAt: { gt: now } },
        _count: { _all: true },
      }),
      prisma.paymentIntent.groupBy({
        by: ["method"],
        where: { purpose: "PROMO_PURCHASE", status: "PAID", paidAt: { gte: since } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    return res.json({
      activeBoosts: boosts.map((b) => ({
        id: b.id,
        code: b.code,
        name: b.product?.name ?? b.code,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        paidWith: b.paidWith,
        username: b.user.username,
        displayName: b.user.displayName,
      })),
      paidPlans: Object.fromEntries(plans.map((p) => [p.tier === "PREMIUM" ? "DIAMOND" : p.tier, p._count._all])),
      sales30d: sales.map((s) => ({ method: s.method, count: s._count._all, amountClp: s._sum.amount ?? 0 })),
    });
  })
);

// Regalo del equipo: no es un cobro, así que no depende del interruptor.
promoRouter.post(
  "/admin/promo/grant",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || "").trim().replace(/^@/, "");
    const productId = String(req.body?.productId || "");
    if (!username || !productId) return res.status(400).json({ error: "VALIDATION", message: "Indica el @usuario y el producto." });

    const [user, product] = await Promise.all([
      prisma.user.findFirst({
        where: { username: { equals: username, mode: "insensitive" } },
        select: { id: true, username: true, profileType: true, tier: true, tierExpiresAt: true, membershipExpiresAt: true },
      }),
      isUUID(productId) ? prisma.promoProduct.findUnique({ where: { id: productId } }) : null,
    ]);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND", message: "No existe ese usuario." });
    if (!product) return res.status(404).json({ error: "PRODUCT_NOT_FOUND", message: "Producto no encontrado." });

    const check = checkPurchase(user, { ...product, isActive: true }, { billingEnabled: true });
    if (!check.ok) return res.status(check.status).json({ error: check.error, message: check.message });

    const result = await prisma.$transaction((tx) =>
      applyPromoPurchase(tx, { userId: user.id, product, paidWith: "ADMIN", amountClp: 0 })
    );
    invalidateBoostCache();
    console.log("[promo] regalo del equipo", { by: (req as any).user?.email, to: user.username, product: product.code });
    return res.json({ ok: true, summary: `@${user.username}: ${result.summary}` });
  })
);
