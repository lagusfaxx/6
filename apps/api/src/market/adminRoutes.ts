import { Router } from "express";
import type { Prisma } from "@prisma/client";

import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { getMarketSettings } from "./settings";
import { confirmOrderPaid, logOrderEvent, rejectOrderPayment, releaseOrderPayout, signOrderAssets } from "./orders";
import { notifyMarket, orderUrl } from "./notify";

export const marketAdminRouter = Router();

function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function str(value: unknown, max = 500): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s ? s.slice(0, max) : null;
}

const profileSelect = { id: true, username: true, displayName: true, avatarUrl: true, email: true } as const;

/* ─────────── Resumen ─────────── */

marketAdminRouter.get("/admin/market/overview", requireAdmin, asyncHandler(async (_req, res) => {
  const [settings, orderCounts, paidAgg, commissionAgg, heldAgg, sellers, products, pendingWithdrawals] = await Promise.all([
    getMarketSettings(),
    prisma.marketOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.marketOrder.aggregate({
      where: { status: { in: ["PAID", "PREPARING", "DELIVERED", "COMPLETED"] } },
      _sum: { totalClp: true },
      _count: { _all: true },
    }),
    prisma.marketOrder.aggregate({
      where: { status: { in: ["PAID", "PREPARING", "DELIVERED", "COMPLETED"] } },
      _sum: { commissionClp: true },
    }),
    prisma.marketOrder.aggregate({
      where: { payoutStatus: "HELD", status: { in: ["PAID", "PREPARING", "DELIVERED"] } },
      _sum: { sellerNetClp: true },
    }),
    prisma.marketSeller.count(),
    prisma.marketProduct.count({ where: { isActive: true, isHidden: false } }),
    prisma.marketWithdrawal.count({ where: { status: "PENDING" } }),
  ]);

  return res.json({
    settings,
    metrics: {
      grossClp: paidAgg._sum.totalClp || 0,
      commissionClp: commissionAgg._sum.commissionClp || 0,
      heldClp: heldAgg._sum.sellerNetClp || 0,
      paidOrders: paidAgg._count._all,
      sellers,
      products,
      pendingWithdrawals,
      pendingTransfers: orderCounts.find((c) => c.status === "PAYMENT_REVIEW")?._count._all || 0,
      byStatus: Object.fromEntries(orderCounts.map((c) => [c.status, c._count._all])),
    },
  });
}));

/* ─────────── Configuración ─────────── */

marketAdminRouter.get("/admin/market/settings", requireAdmin, asyncHandler(async (_req, res) => {
  const [settings, rates] = await Promise.all([
    getMarketSettings(),
    prisma.marketShippingRate.findMany({ orderBy: { region: "asc" } }),
  ]);
  return res.json({ settings, shippingRates: rates });
}));

marketAdminRouter.put("/admin/market/settings", requireAdmin, asyncHandler(async (req, res) => {
  const current = await getMarketSettings();
  const data: Prisma.MarketSettingsUpdateInput = {};

  if (req.body?.isEnabled !== undefined) data.isEnabled = Boolean(req.body.isEnabled);
  if (req.body?.gatewayEnabled !== undefined) data.gatewayEnabled = Boolean(req.body.gatewayEnabled);
  if (req.body?.transferEnabled !== undefined) data.transferEnabled = Boolean(req.body.transferEnabled);
  if (req.body?.commissionPercent !== undefined) {
    const pct = Number(req.body.commissionPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 60) return res.status(400).json({ error: "COMMISSION_INVALID" });
    data.commissionPercent = pct;
  }
  if (req.body?.holdDays !== undefined) {
    const days = toInt(req.body.holdDays, current.holdDays);
    if (days < 0 || days > 60) return res.status(400).json({ error: "HOLD_DAYS_INVALID" });
    data.holdDays = days;
  }
  if (req.body?.minPriceClp !== undefined) data.minPriceClp = Math.max(0, toInt(req.body.minPriceClp, current.minPriceClp));
  if (req.body?.maxPriceClp !== undefined) data.maxPriceClp = Math.max(1, toInt(req.body.maxPriceClp, current.maxPriceClp));
  for (const field of ["bankName", "bankAccountType", "bankAccountNumber", "bankHolderName", "bankHolderRut", "bankEmail", "transferNote"] as const) {
    if (req.body?.[field] !== undefined) (data as any)[field] = str(req.body[field], 200);
  }

  const settings = await prisma.marketSettings.update({ where: { id: current.id }, data });
  return res.json({ settings });
}));

/* ─────────── Tarifas de envío ─────────── */

marketAdminRouter.post("/admin/market/shipping-rates", requireAdmin, asyncHandler(async (req, res) => {
  const region = str(req.body?.region, 80);
  if (!region) return res.status(400).json({ error: "REGION_REQUIRED" });

  const rate = await prisma.marketShippingRate.upsert({
    where: { region },
    create: {
      region,
      priceClp: Math.max(0, toInt(req.body?.priceClp, 0)),
      etaText: str(req.body?.etaText, 80),
      isActive: req.body?.isActive !== false,
    },
    update: {
      priceClp: Math.max(0, toInt(req.body?.priceClp, 0)),
      etaText: str(req.body?.etaText, 80),
      isActive: req.body?.isActive !== false,
    },
  });
  return res.json({ rate });
}));

marketAdminRouter.put("/admin/market/shipping-rates/:id", requireAdmin, asyncHandler(async (req, res) => {
  const data: Prisma.MarketShippingRateUpdateInput = {};
  if (req.body?.priceClp !== undefined) data.priceClp = Math.max(0, toInt(req.body.priceClp, 0));
  if (req.body?.etaText !== undefined) data.etaText = str(req.body.etaText, 80);
  if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  if (req.body?.region !== undefined) {
    const region = str(req.body.region, 80);
    if (!region) return res.status(400).json({ error: "REGION_REQUIRED" });
    data.region = region;
  }

  const rate = await prisma.marketShippingRate.update({ where: { id: String(req.params.id) }, data });
  return res.json({ rate });
}));

marketAdminRouter.delete("/admin/market/shipping-rates/:id", requireAdmin, asyncHandler(async (req, res) => {
  // Se desactiva en vez de borrarse: hay pedidos que apuntan a la tarifa.
  const rate = await prisma.marketShippingRate.update({ where: { id: String(req.params.id) }, data: { isActive: false } });
  return res.json({ rate });
}));

/* ─────────── Pedidos ─────────── */

marketAdminRouter.get("/admin/market/orders", requireAdmin, asyncHandler(async (req, res) => {
  const status = String(req.query.status || "").toUpperCase();
  const q = str(req.query.q, 80);
  const take = Math.min(200, Math.max(1, toInt(req.query.limit, 60)));
  const skip = Math.max(0, toInt(req.query.offset, 0));

  const where: Prisma.MarketOrderWhereInput = {
    ...(status && status !== "ALL" ? { status: status as any } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { productTitle: { contains: q, mode: "insensitive" } },
            { buyer: { username: { contains: q, mode: "insensitive" } } },
            { seller: { username: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.marketOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        buyer: { select: profileSelect },
        seller: { select: profileSelect },
        product: { select: { id: true, coverUrl: true, type: true } },
        _count: { select: { assets: true, messages: true } },
      },
    }),
    prisma.marketOrder.count({ where }),
  ]);

  return res.json({ orders, total, hasMore: skip + orders.length < total });
}));

/** Detalle completo: incluye contenido entregado, chat y bitácora. */
marketAdminRouter.get("/admin/market/orders/:id", requireAdmin, asyncHandler(async (req, res) => {
  const order = await prisma.marketOrder.findUnique({
    where: { id: String(req.params.id) },
    include: {
      buyer: { select: profileSelect },
      seller: { select: profileSelect },
      product: { include: { media: { orderBy: { pos: "asc" } } } },
      assets: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: profileSelect } } },
      review: true,
      ledger: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  return res.json({
    order,
    assets: signOrderAssets(order.assets),
    messages: order.messages,
    events: order.events,
  });
}));

/** Aprobar el comprobante de una transferencia: equivale a un pago confirmado. */
marketAdminRouter.post("/admin/market/orders/:id/approve-transfer", requireAdmin, asyncHandler(async (req, res) => {
  const adminId = (req as any).user?.id;
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.status !== "PAYMENT_REVIEW" && order.status !== "PENDING_PAYMENT") {
    return res.status(400).json({ error: "INVALID_STATE" });
  }

  const updated = await confirmOrderPaid(order.id, { source: "transfer_admin" });
  await logOrderEvent(order.id, "TRANSFER_APPROVED", { actorId: adminId });
  return res.json({ order: updated });
}));

marketAdminRouter.post("/admin/market/orders/:id/reject-transfer", requireAdmin, asyncHandler(async (req, res) => {
  const adminId = (req as any).user?.id;
  const reason = str(req.body?.reason, 300) || "Comprobante rechazado";
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });

  const updated = await rejectOrderPayment(order.id, reason);
  await logOrderEvent(order.id, "TRANSFER_REJECTED", { actorId: adminId, note: reason });
  return res.json({ order: updated });
}));

/** Liberar el pago antes de tiempo (por ejemplo tras resolver un reclamo). */
marketAdminRouter.post("/admin/market/orders/:id/release", requireAdmin, asyncHandler(async (req, res) => {
  const adminId = (req as any).user?.id;
  const updated = await releaseOrderPayout(String(req.params.id), "admin");
  if (!updated) return res.status(404).json({ error: "NOT_FOUND" });
  await logOrderEvent(String(req.params.id), "ADMIN_RELEASED", { actorId: adminId });
  return res.json({ order: updated });
}));

/** Reembolso: el dinero retenido no llega a la vendedora. */
marketAdminRouter.post("/admin/market/orders/:id/refund", requireAdmin, asyncHandler(async (req, res) => {
  const adminId = (req as any).user?.id;
  const reason = str(req.body?.reason, 300) || "Reembolso autorizado por administración";
  const order = await prisma.marketOrder.findUnique({ where: { id: String(req.params.id) } });
  if (!order) return res.status(404).json({ error: "NOT_FOUND" });
  if (order.payoutStatus !== "HELD") {
    return res.status(400).json({ error: "ALREADY_RELEASED", message: "El pago ya fue liberado a la vendedora." });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.marketOrder.update({
      where: { id: order.id },
      data: {
        status: "REFUNDED",
        payoutStatus: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: reason,
        disputeResolution: order.status === "DISPUTED" ? `Resuelto a favor de la clienta: ${reason}` : order.disputeResolution,
      },
    });
    await tx.marketLedgerEntry.create({
      data: {
        userId: order.sellerId,
        orderId: order.id,
        type: "REFUND",
        amountClp: -order.sellerNetClp,
        description: `Reembolso ${order.code}: ${reason}`,
      },
    });
    return result;
  });

  await logOrderEvent(order.id, "ORDER_REFUNDED", { actorId: adminId, note: reason });
  await notifyMarket(order.buyerId, "MARKET_ORDER_CANCELLED", {
    title: `Pedido ${order.code} reembolsado`,
    body: reason,
    url: orderUrl(order.id, false),
    orderId: order.id,
    orderCode: order.code,
  });
  await notifyMarket(order.sellerId, "MARKET_ORDER_CANCELLED", {
    title: `Pedido ${order.code} reembolsado`,
    body: reason,
    url: orderUrl(order.id, true),
    orderId: order.id,
    orderCode: order.code,
  });

  return res.json({ order: updated });
}));

/* ─────────── Catálogo y tiendas ─────────── */

marketAdminRouter.get("/admin/market/products", requireAdmin, asyncHandler(async (req, res) => {
  const q = str(req.query.q, 80);
  const take = Math.min(200, Math.max(1, toInt(req.query.limit, 60)));
  const skip = Math.max(0, toInt(req.query.offset, 0));

  const where: Prisma.MarketProductWhereInput = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { user: { username: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const [products, total] = await Promise.all([
    prisma.marketProduct.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        media: { orderBy: { pos: "asc" } },
        user: { select: profileSelect },
        _count: { select: { assets: true, orders: true } },
      },
    }),
    prisma.marketProduct.count({ where }),
  ]);

  return res.json({ products, total, hasMore: skip + products.length < total });
}));

marketAdminRouter.put("/admin/market/products/:id/visibility", requireAdmin, asyncHandler(async (req, res) => {
  const product = await prisma.marketProduct.update({
    where: { id: String(req.params.id) },
    data: { isHidden: Boolean(req.body?.isHidden) },
  });
  return res.json({ product });
}));

marketAdminRouter.get("/admin/market/sellers", requireAdmin, asyncHandler(async (req, res) => {
  const take = Math.min(200, Math.max(1, toInt(req.query.limit, 60)));
  const sellers = await prisma.marketSeller.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: { select: profileSelect },
      _count: { select: { products: true } },
    },
  });
  return res.json({ sellers });
}));

marketAdminRouter.put("/admin/market/sellers/:id/status", requireAdmin, asyncHandler(async (req, res) => {
  const data: Prisma.MarketSellerUpdateInput = {};
  if (req.body?.isBanned !== undefined) data.isBanned = Boolean(req.body.isBanned);
  if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
  const seller = await prisma.marketSeller.update({ where: { id: String(req.params.id) }, data });
  return res.json({ seller });
}));

/* ─────────── Retiros ─────────── */

marketAdminRouter.get("/admin/market/withdrawals", requireAdmin, asyncHandler(async (req, res) => {
  const status = String(req.query.status || "").toUpperCase();
  const withdrawals = await prisma.marketWithdrawal.findMany({
    where: status && status !== "ALL" ? { status: status as any } : {},
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { user: { select: profileSelect }, seller: { select: { storeName: true } } },
  });
  return res.json({ withdrawals });
}));

marketAdminRouter.put("/admin/market/withdrawals/:id", requireAdmin, asyncHandler(async (req, res) => {
  const adminId = (req as any).user?.id;
  const action = String(req.body?.action || "").toUpperCase();
  const withdrawal = await prisma.marketWithdrawal.findUnique({ where: { id: String(req.params.id) } });
  if (!withdrawal) return res.status(404).json({ error: "NOT_FOUND" });

  const statusByAction: Record<string, "APPROVED" | "REJECTED" | "PAID"> = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    PAY: "PAID",
  };
  const nextStatus = statusByAction[action];
  if (!nextStatus) return res.status(400).json({ error: "INVALID_ACTION" });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.marketWithdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: nextStatus,
        adminNote: str(req.body?.note, 300),
        reviewedBy: adminId || null,
        reviewedAt: new Date(),
        paidAt: nextStatus === "PAID" ? new Date() : withdrawal.paidAt,
      },
    });

    // El movimiento de salida se anota una sola vez: al aprobar, o al pagar
    // directamente si se saltó la aprobación.
    if ((nextStatus === "APPROVED" || nextStatus === "PAID") && withdrawal.status === "PENDING") {
      await tx.marketLedgerEntry.create({
        data: {
          userId: withdrawal.userId,
          type: "WITHDRAWAL",
          amountClp: -withdrawal.amountClp,
          description: `Retiro aprobado por administración`,
        },
      });
    }
    return result;
  });

  await notifyMarket(withdrawal.userId, "MARKET_PAYOUT_RELEASED", {
    title:
      nextStatus === "REJECTED"
        ? "Retiro rechazado"
        : nextStatus === "PAID"
          ? "Retiro transferido"
          : "Retiro aprobado",
    body:
      nextStatus === "REJECTED"
        ? str(req.body?.note, 200) || "Revisa tus datos bancarios e inténtalo de nuevo."
        : `Monto: $${withdrawal.amountClp.toLocaleString("es-CL")}`,
    url: "/marketplace/vender?tab=ganancias",
    amountClp: withdrawal.amountClp,
  });

  return res.json({ withdrawal: updated });
}));

/* ─────────── Chats del marketplace ─────────── */

marketAdminRouter.get("/admin/market/messages", requireAdmin, asyncHandler(async (req, res) => {
  const take = Math.min(200, Math.max(1, toInt(req.query.limit, 80)));
  const messages = await prisma.marketOrderMessage.findMany({
    orderBy: { createdAt: "desc" },
    take,
    include: {
      sender: { select: profileSelect },
      order: { select: { id: true, code: true, productTitle: true, buyerId: true, sellerId: true } },
    },
  });
  return res.json({ messages });
}));
