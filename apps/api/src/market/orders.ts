import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { prisma } from "../db";
import { getMarketSettings } from "./settings";
import { notifyMarket, orderUrl, formatClp } from "./notify";
import { buildOrderAssetUrl } from "./media";
import { sendMarketOrderPaidEmail, sendMarketPayoutReleasedEmail } from "../lib/marketEmail";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Código corto y legible del pedido (el que se cita en el chat o el correo). */
export function generateOrderCode(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (let i = 0; i < 6; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `MK-${out}`;
}

export async function logOrderEvent(
  orderId: string,
  type: string,
  opts: { actorId?: string | null; note?: string | null; data?: Prisma.InputJsonValue } = {},
) {
  await prisma.marketOrderEvent.create({
    data: {
      orderId,
      type,
      actorId: opts.actorId || null,
      note: opts.note || null,
      data: opts.data,
    },
  }).catch((err) => console.error("[market] event log failed", { orderId, type, error: err?.message || err }));
}

/**
 * Copia los archivos del producto al pedido. Es una copia por pedido a
 * propósito: si la vendedora cambia o borra el producto después, la compradora
 * conserva exactamente lo que pagó.
 */
export async function deliverDigitalAssets(orderId: string): Promise<number> {
  const order = await prisma.marketOrder.findUnique({
    where: { id: orderId },
    select: { id: true, productId: true, assets: { select: { id: true } } },
  });
  if (!order || !order.productId) return 0;
  if (order.assets.length > 0) return order.assets.length; // ya entregado

  const assets = await prisma.marketProductAsset.findMany({
    where: { productId: order.productId },
    orderBy: { pos: "asc" },
  });
  if (!assets.length) return 0;

  await prisma.marketOrderAsset.createMany({
    data: assets.map((a) => ({
      orderId: order.id,
      assetId: a.id,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
      type: a.type,
    })),
  });

  await prisma.marketOrder.update({
    where: { id: order.id },
    data: { autoDelivered: true, deliveredAt: new Date(), status: "DELIVERED" },
  });

  await logOrderEvent(order.id, "AUTO_DELIVERED", { note: `${assets.length} archivo(s) entregados automáticamente` });
  return assets.length;
}

/**
 * Marca el pedido como pagado: retiene el dinero, anota comisión y neto,
 * entrega el contenido digital si la vendedora tiene la entrega automática y
 * avisa a las dos partes.
 *
 * Es idempotente: la pasarela puede reenviar la confirmación del mismo pago.
 */
export async function confirmOrderPaid(
  orderId: string,
  opts: { providerPaymentId?: string | null; source: string } = { source: "flow" },
) {
  const order = await prisma.marketOrder.findUnique({
    where: { id: orderId },
    include: {
      product: { select: { id: true, autoDeliver: true, type: true, salesCount: true } },
      buyer: { select: { id: true, displayName: true, username: true, email: true } },
      seller: { select: { id: true, displayName: true, username: true, email: true } },
    },
  });
  if (!order) return null;
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_REVIEW") return order;

  const settings = await getMarketSettings();
  const now = new Date();
  const autoReleaseAt = new Date(now.getTime() + settings.holdDays * 24 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.marketOrder.update({
      where: { id: order.id },
      data: { status: "PAID", paidAt: now, autoReleaseAt, payoutStatus: "HELD" },
    });

    // El dinero de la venta queda registrado como retenido; la comisión de
    // UZEED se anota en el mismo momento para que el reporte cuadre.
    await tx.marketLedgerEntry.createMany({
      data: [
        {
          userId: order.sellerId,
          orderId: order.id,
          type: "SALE",
          amountClp: order.sellerNetClp,
          description: `Venta ${order.code} (retenida hasta la confirmación de entrega)`,
        },
        {
          userId: order.sellerId,
          orderId: order.id,
          type: "COMMISSION",
          amountClp: -order.commissionClp,
          description: `Comisión UZEED ${order.commissionPercent}% — ${order.code}`,
        },
      ],
    });

    if (order.productId) {
      await tx.marketProduct.update({
        where: { id: order.productId },
        data: {
          salesCount: { increment: order.quantity },
          ...(await stockDecrement(tx, order.productId, order.quantity)),
        },
      });
    }
  });

  await logOrderEvent(order.id, "PAYMENT_CONFIRMED", {
    note: `Pago confirmado (${opts.source})`,
    data: { providerPaymentId: opts.providerPaymentId || null, totalClp: order.totalClp },
  });

  // Entrega automática del contenido digital.
  let deliveredCount = 0;
  const isDigital = order.deliveryMethod === "DIGITAL";
  if (isDigital && order.product?.autoDeliver) {
    deliveredCount = await deliverDigitalAssets(order.id).catch((err) => {
      console.error("[market] auto delivery failed", { orderId: order.id, error: err?.message || err });
      return 0;
    });
  }

  const buyerName = order.buyer.displayName || order.buyer.username;
  const sellerName = order.seller.displayName || order.seller.username;

  await notifyMarket(order.sellerId, "MARKET_NEW_ORDER", {
    title: `Nueva venta ${order.code}`,
    body: deliveredCount
      ? `${buyerName} compró "${order.productTitle}". Se entregó automáticamente. Recibirás ${formatClp(order.sellerNetClp)}.`
      : `${buyerName} compró "${order.productTitle}" por ${formatClp(order.totalClp)}. Revisa cómo entregarlo.`,
    url: orderUrl(order.id, true),
    orderId: order.id,
    orderCode: order.code,
    amountClp: order.sellerNetClp,
  });

  await notifyMarket(order.buyerId, "MARKET_ORDER_PAID", {
    title: `Pago confirmado — ${order.code}`,
    body: deliveredCount
      ? `Tu contenido ya está disponible en tus compras.`
      : `${sellerName} recibió tu pedido y coordinará la entrega contigo.`,
    url: orderUrl(order.id, false),
    orderId: order.id,
    orderCode: order.code,
  });

  await Promise.allSettled([
    sendMarketOrderPaidEmail(order.seller.email, {
      forSeller: true,
      name: sellerName,
      code: order.code,
      productTitle: order.productTitle,
      amountClp: order.sellerNetClp,
      deliveryMethod: order.deliveryMethod,
      autoDelivered: deliveredCount > 0,
      holdDays: settings.holdDays,
    }),
    sendMarketOrderPaidEmail(order.buyer.email, {
      forSeller: false,
      name: buyerName,
      code: order.code,
      productTitle: order.productTitle,
      amountClp: order.totalClp,
      deliveryMethod: order.deliveryMethod,
      autoDelivered: deliveredCount > 0,
      holdDays: settings.holdDays,
    }),
  ]);

  return prisma.marketOrder.findUnique({ where: { id: order.id } });
}

/** Descuenta stock solo si el producto lo lleva (null = ilimitado). */
async function stockDecrement(tx: Prisma.TransactionClient, productId: string, quantity: number) {
  const product = await tx.marketProduct.findUnique({ where: { id: productId }, select: { stock: true } });
  if (!product || product.stock === null) return {};
  return { stock: Math.max(0, product.stock - quantity) };
}

/** Marca el pago como rechazado por la pasarela. */
export async function rejectOrderPayment(orderId: string, reason: string) {
  const order = await prisma.marketOrder.findUnique({ where: { id: orderId } });
  if (!order) return null;
  if (order.status !== "PENDING_PAYMENT" && order.status !== "PAYMENT_REVIEW") return order;

  const updated = await prisma.marketOrder.update({
    where: { id: order.id },
    data: { status: "REJECTED", cancelledAt: new Date(), cancelReason: reason, payoutStatus: "CANCELLED" },
  });
  await logOrderEvent(order.id, "PAYMENT_REJECTED", { note: reason });

  await notifyMarket(order.buyerId, "MARKET_ORDER_CANCELLED", {
    title: `Pago rechazado — ${order.code}`,
    body: "No pudimos confirmar tu pago. Puedes intentarlo de nuevo desde el marketplace.",
    url: orderUrl(order.id, false),
    orderId: order.id,
    orderCode: order.code,
  });
  return updated;
}

/**
 * Libera el dinero retenido a la vendedora. Ocurre cuando la clienta marca el
 * pedido como recibido o cuando vencen los días de retención.
 */
export async function releaseOrderPayout(orderId: string, reason: "buyer_confirmed" | "auto_release" | "admin") {
  const order = await prisma.marketOrder.findUnique({
    where: { id: orderId },
    include: { seller: { select: { id: true, email: true, displayName: true, username: true } } },
  });
  if (!order) return null;
  if (order.payoutStatus !== "HELD") return order;
  if (!["PAID", "PREPARING", "DELIVERED"].includes(order.status)) return order;

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.marketOrder.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        payoutStatus: "RELEASED",
        completedAt: now,
        buyerConfirmedAt: reason === "buyer_confirmed" ? now : order.buyerConfirmedAt,
      },
    });

    await tx.marketLedgerEntry.create({
      data: {
        userId: order.sellerId,
        orderId: order.id,
        type: "RELEASE",
        amountClp: 0,
        description:
          reason === "auto_release"
            ? `Pago liberado automáticamente — ${order.code}`
            : reason === "admin"
              ? `Pago liberado por administración — ${order.code}`
              : `Pago liberado tras confirmación de la clienta — ${order.code}`,
      },
    });

    const seller = await tx.marketSeller.findUnique({ where: { userId: order.sellerId }, select: { id: true } });
    if (seller) {
      await tx.marketSeller.update({
        where: { id: seller.id },
        data: { totalSales: { increment: 1 }, totalEarnedClp: { increment: order.sellerNetClp } },
      });
    }
    return result;
  });

  await logOrderEvent(order.id, "PAYOUT_RELEASED", { note: reason });

  const sellerName = order.seller.displayName || order.seller.username;
  await notifyMarket(order.sellerId, "MARKET_PAYOUT_RELEASED", {
    title: `Pago liberado — ${order.code}`,
    body: `${formatClp(order.sellerNetClp)} quedaron disponibles para retiro.`,
    url: "/marketplace/vender?tab=ganancias",
    orderId: order.id,
    orderCode: order.code,
    amountClp: order.sellerNetClp,
  });
  await sendMarketPayoutReleasedEmail(order.seller.email, {
    name: sellerName,
    code: order.code,
    amountClp: order.sellerNetClp,
    auto: reason === "auto_release",
  }).catch(() => undefined);

  return updated;
}

/** Saldo de la vendedora: liberado, retenido y ya retirado. */
export async function getSellerBalance(userId: string) {
  const [heldAgg, releasedAgg, withdrawnAgg, pendingWithdrawals] = await Promise.all([
    prisma.marketOrder.aggregate({
      where: { sellerId: userId, payoutStatus: "HELD", status: { in: ["PAID", "PREPARING", "DELIVERED"] } },
      _sum: { sellerNetClp: true },
    }),
    prisma.marketOrder.aggregate({
      where: { sellerId: userId, payoutStatus: { in: ["RELEASED", "PAID"] } },
      _sum: { sellerNetClp: true },
    }),
    prisma.marketWithdrawal.aggregate({
      where: { userId, status: { in: ["APPROVED", "PAID"] } },
      _sum: { amountClp: true },
    }),
    prisma.marketWithdrawal.aggregate({
      where: { userId, status: "PENDING" },
      _sum: { amountClp: true },
    }),
  ]);

  const held = heldAgg._sum.sellerNetClp || 0;
  const releasedTotal = releasedAgg._sum.sellerNetClp || 0;
  const withdrawn = withdrawnAgg._sum.amountClp || 0;
  const requested = pendingWithdrawals._sum.amountClp || 0;

  return {
    heldClp: held,
    releasedClp: releasedTotal,
    withdrawnClp: withdrawn,
    pendingWithdrawalClp: requested,
    availableClp: Math.max(0, releasedTotal - withdrawn - requested),
  };
}

/**
 * Libera los pedidos cuya retención venció. Lo llama el worker cada hora: si
 * la clienta nunca confirma, la vendedora igual cobra pasados los días
 * configurados.
 */
export async function releaseExpiredHolds(): Promise<number> {
  const due = await prisma.marketOrder.findMany({
    where: {
      payoutStatus: "HELD",
      status: { in: ["PAID", "PREPARING", "DELIVERED"] },
      autoReleaseAt: { lte: new Date() },
    },
    select: { id: true },
    take: 200,
  });

  let released = 0;
  for (const order of due) {
    try {
      await releaseOrderPayout(order.id, "auto_release");
      released++;
    } catch (err: any) {
      console.error("[market] auto release failed", { orderId: order.id, error: err?.message || err });
    }
  }
  return released;
}

/** URLs firmadas del contenido comprado (caducan a los 15 minutos). */
export function signOrderAssets(assets: Array<{ id: string; type: string; thumbnailUrl: string | null }>) {
  return assets.map((asset) => ({
    id: asset.id,
    type: asset.type,
    url: buildOrderAssetUrl(asset.id, "asset"),
    thumbnailUrl: asset.thumbnailUrl ? buildOrderAssetUrl(asset.id, "thumb") : null,
  }));
}
