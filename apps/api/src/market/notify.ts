import { prisma } from "../db";
import { config } from "../config";
import { sendToUser } from "../realtime/sse";
import type { NotificationType } from "@prisma/client";

/**
 * Avisos del marketplace. Crear la Notification ya dispara el push (middleware
 * de Prisma en db.ts) y el aviso por WhatsApp cuando corresponde, así que aquí
 * solo se arma el contenido y se empuja también por SSE para que la pantalla
 * abierta se entere sin recargar.
 */
export async function notifyMarket(
  userId: string,
  type: NotificationType,
  payload: { title: string; body: string; url: string; orderId?: string; orderCode?: string; amountClp?: number },
) {
  const data = { ...payload, tag: payload.orderId ? `market-${payload.orderId}` : `market-${type}` };
  try {
    await prisma.notification.create({ data: { userId, type, data } });
  } catch (err: any) {
    console.error("[market] notification failed", { userId, type, error: err?.message || err });
  }
  try {
    sendToUser(userId, "market_event", { type, ...data });
  } catch {
    // SSE es best-effort: la notificación ya quedó guardada.
  }
}

export function orderUrl(orderId: string, forSeller: boolean): string {
  return forSeller ? `/marketplace/vender/pedidos/${orderId}` : `/marketplace/compras/${orderId}`;
}

export function absoluteUrl(path: string): string {
  return `${(config.appUrl || "").replace(/\/$/, "")}${path}`;
}

export function formatClp(value: number): string {
  return `$${Math.round(value || 0).toLocaleString("es-CL")}`;
}
