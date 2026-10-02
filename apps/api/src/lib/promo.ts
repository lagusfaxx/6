import type { Prisma, PromoCode, PromoProduct } from "@prisma/client";
import { prisma } from "../db";
import { membershipRenewalBase } from "./billingSettings";

/**
 * Membresía y boosts (Subir al top, Destacada) de los perfiles profesionales.
 *
 * - Gold y Diamond ya no se venden: son una categorización interna que sale
 *   de la tarifa del perfil (ver `professionalLevel.ts`). Lo que se cobra
 *   son los boosts.
 * - El plan Silver es la membresía: dura `duration` días y sólo extiende
 *   `membershipExpiresAt` (el perfil se ve con el cobro activo). No toca el
 *   rango.
 * - Un boost dura `duration` horas y se acumula: si ya hay uno del mismo tipo
 *   vigente, el nuevo empieza cuando termina el anterior.
 * - Se pagan con Flow (webhook) o con tokens de la billetera (al instante).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type PlanCode = "SILVER" | "GOLD" | "DIAMOND";
export type BoostCode = "BUMP" | "SPOTLIGHT";

/** Planes que todavía se venden (la membresía). Gold y Diamond van por tarifa. */
export const SELLABLE_PLAN_CODES: readonly PlanCode[] = ["SILVER"];

export function isPlanCode(code: PromoCode | string): code is PlanCode {
  return code === "SILVER" || code === "GOLD" || code === "DIAMOND";
}

/** Tokens que cuesta un producto con la tasa vigente (CLP por token). */
export function tokensFor(priceClp: number, tokenRateClp: number) {
  return Math.ceil(priceClp / Math.max(1, tokenRateClp));
}

export async function getTokenRate(): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({ where: { key: "token_rate_clp" } });
  const n = cfg ? parseInt(cfg.value, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export async function getActiveCatalog() {
  return prisma.promoProduct.findMany({
    where: {
      isActive: true,
      OR: [{ kind: "BOOST" }, { kind: "PLAN", code: { in: [...SELLABLE_PLAN_CODES] } }],
    },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { priceClp: "asc" }],
  });
}

type PlanUser = {
  membershipExpiresAt: Date | null;
};

export type PurchaseCheck = { ok: true } | { ok: false; status: number; error: string; message: string };

/** Reglas de compra (las mismas para Flow, tokens y regalos del admin). */
export function checkPurchase(
  user: { profileType: string },
  product: PromoProduct,
  opts: { billingEnabled: boolean }
): PurchaseCheck {
  if (user.profileType !== "PROFESSIONAL") {
    return { ok: false, status: 400, error: "NOT_PROFESSIONAL", message: "Los planes y boosts son para perfiles profesionales." };
  }
  // Todo lo que se vende depende del interruptor de cobro: apagado, UZEED
  // funciona como siempre (registro libre, sin vencimientos, nada a la venta).
  if (!opts.billingEnabled) {
    return {
      ok: false,
      status: 409,
      error: "BILLING_DISABLED",
      message: "Por ahora UZEED es gratis: los planes y boosts todavía no están a la venta.",
    };
  }
  if (!product.isActive) {
    return { ok: false, status: 400, error: "PRODUCT_INACTIVE", message: "Este producto ya no está disponible." };
  }
  if (product.kind === "PLAN" && !SELLABLE_PLAN_CODES.includes(product.code as PlanCode)) {
    return {
      ok: false,
      status: 409,
      error: "PLAN_DISCONTINUED",
      message: "Gold y Diamond ya no se venden: el rango depende de tu tarifa. Para más visibilidad, activa un boost.",
    };
  }
  return { ok: true };
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
}

/**
 * Membresía comprada (sin tocar la base, para poder probarla): se suma desde
 * el vencimiento vigente o desde hoy.
 */
export function computeMembershipPurchase(
  user: PlanUser,
  days: number,
  now = new Date()
): Date {
  const base = membershipRenewalBase(user.membershipExpiresAt, now);
  return new Date(base.getTime() + days * DAY_MS);
}

type Tx = Prisma.TransactionClient;

export type ApplyInput = {
  userId: string;
  product: PromoProduct;
  paidWith: "FLOW" | "TOKENS" | "ADMIN";
  amountClp: number;
  paymentIntentId?: string | null;
};

/** Aplica la compra dentro de una transacción. Devuelve un resumen legible. */
export async function applyPromoPurchase(tx: Tx, input: ApplyInput): Promise<{ summary: string; endsAt: Date | null }> {
  const { product } = input;
  const now = new Date();

  if (product.kind === "PLAN" && isPlanCode(product.code)) {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { membershipExpiresAt: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const membershipExpiresAt = computeMembershipPurchase(user, product.duration, now);
    await tx.user.update({ where: { id: input.userId }, data: { membershipExpiresAt } });

    const summary = `${product.name} activa hasta el ${fmtDate(membershipExpiresAt)}`;
    await tx.notification.create({
      data: {
        userId: input.userId,
        type: "SUBSCRIPTION_STARTED",
        data: { title: `${product.name} activada`, body: summary, url: "/planes", source: `promo_${input.paidWith.toLowerCase()}` },
      },
    });
    return { summary, endsAt: membershipExpiresAt };
  }

  // Boost: se encadena con el vigente del mismo tipo.
  const last = await tx.profileBoost.findFirst({
    where: { userId: input.userId, code: product.code, endsAt: { gt: now } },
    orderBy: { endsAt: "desc" },
    select: { endsAt: true },
  });
  const startsAt = last ? last.endsAt : now;
  const endsAt = new Date(startsAt.getTime() + product.duration * HOUR_MS);
  await tx.profileBoost.create({
    data: {
      userId: input.userId,
      productId: product.id,
      code: product.code,
      startsAt,
      endsAt,
      paidWith: input.paidWith,
      amountClp: input.amountClp,
      paymentIntentId: input.paymentIntentId ?? null,
    },
  });
  const summary = `${product.name} activo hasta el ${endsAt.toLocaleString("es-CL", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  })}`;
  await tx.notification.create({
    data: {
      userId: input.userId,
      type: "SUBSCRIPTION_STARTED",
      data: { title: `${product.name} activado`, body: summary, url: "/planes", source: `boost_${input.paidWith.toLowerCase()}` },
    },
  });
  return { summary, endsAt };
}

/* ── Boosts vigentes (caché corto: se consultan en cada listado) ── */

let boostCache: { at: number; bump: Set<string>; spotlight: Set<string> } | null = null;
const BOOST_CACHE_MS = 60_000;

export async function getActiveBoostSets(): Promise<{ bump: Set<string>; spotlight: Set<string> }> {
  if (boostCache && Date.now() - boostCache.at < BOOST_CACHE_MS) return boostCache;
  const now = new Date();
  const rows = await prisma.profileBoost
    .findMany({
      where: { startsAt: { lte: now }, endsAt: { gt: now } },
      select: { userId: true, code: true },
    })
    .catch(() => [] as { userId: string; code: PromoCode }[]);
  const bump = new Set<string>();
  const spotlight = new Set<string>();
  for (const r of rows) {
    if (r.code === "SPOTLIGHT") spotlight.add(r.userId);
    else bump.add(r.userId);
  }
  boostCache = { at: Date.now(), bump, spotlight };
  return boostCache;
}

export function invalidateBoostCache() {
  boostCache = null;
}

/** 0 = Destacada, 1 = Subir al top, 2 = sin boost (para ordenar). */
export function boostRank(id: string, sets: { bump: Set<string>; spotlight: Set<string> }) {
  if (sets.spotlight.has(id)) return 0;
  if (sets.bump.has(id)) return 1;
  return 2;
}
