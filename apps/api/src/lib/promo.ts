import type { Prisma, PromoCode, PromoProduct, ProfessionalTier } from "@prisma/client";
import { prisma } from "../db";

/**
 * Planes (Silver, Gold, Diamond) y boosts (Subir al top, Destacada) de los
 * perfiles profesionales.
 *
 * - Un plan dura `duration` días: fija el rango del perfil (`tier` con
 *   `tierExpiresAt`) y además cuenta como membresía (el perfil se ve con el
 *   cobro activo). Diamond se guarda como PREMIUM en la base.
 * - Un boost dura `duration` horas y se acumula: si ya hay uno del mismo tipo
 *   vigente, el nuevo empieza cuando termina el anterior.
 * - Se pagan con Flow (webhook) o con tokens de la billetera (al instante).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type PlanCode = "SILVER" | "GOLD" | "DIAMOND";
export type BoostCode = "BUMP" | "SPOTLIGHT";

export const PLAN_RANK: Record<PlanCode, number> = { SILVER: 1, GOLD: 2, DIAMOND: 3 };

export function planToTier(code: PlanCode): ProfessionalTier {
  return code === "DIAMOND" ? "PREMIUM" : code;
}

export function tierToPlan(tier: ProfessionalTier | string | null | undefined): PlanCode | null {
  if (tier === "PREMIUM") return "DIAMOND";
  if (tier === "GOLD" || tier === "SILVER") return tier;
  return null;
}

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
    where: { isActive: true },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { priceClp: "asc" }],
  });
}

type PlanUser = {
  tier: ProfessionalTier | null;
  tierExpiresAt: Date | null;
  membershipExpiresAt: Date | null;
};

/** Plan vigente del perfil: pagado (con vencimiento) o asignado a mano. */
export function currentPlan(user: PlanUser, now = new Date()) {
  const code = tierToPlan(user.tier);
  if (!code) return null;
  if (!user.tierExpiresAt) {
    // Silver "a mano" es el que se guarda al registrarse gratis, no un plan.
    if (code === "SILVER") return null;
    return { code, manual: true, expiresAt: null as Date | null };
  }
  if (user.tierExpiresAt.getTime() <= now.getTime()) return null;
  return { code, manual: false, expiresAt: user.tierExpiresAt };
}

export type PurchaseCheck = { ok: true } | { ok: false; status: number; error: string; message: string };

/** Reglas de compra (las mismas para Flow, tokens y regalos del admin). */
export function checkPurchase(
  user: PlanUser & { profileType: string },
  product: PromoProduct,
  opts: { billingEnabled: boolean; now?: Date }
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
  if (product.kind === "PLAN" && isPlanCode(product.code)) {
    const plan = currentPlan(user, opts.now);
    if (plan && !plan.manual && PLAN_RANK[product.code] < PLAN_RANK[plan.code]) {
      return {
        ok: false,
        status: 409,
        error: "PLAN_DOWNGRADE",
        message: `Tienes ${planLabel(plan.code)} vigente hasta el ${fmtDate(plan.expiresAt!)}. Podrás cambiar a un plan menor cuando termine.`,
      };
    }
  }
  return { ok: true };
}

export function planLabel(code: PlanCode) {
  return code === "DIAMOND" ? "Diamond" : code === "GOLD" ? "Gold" : "Silver";
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "long", timeZone: "America/Santiago" });
}

/**
 * Cálculo de un plan comprado (sin tocar la base, para poder probarlo):
 * - mismo plan vigente → se extiende desde su vencimiento;
 * - plan mayor con uno menor vigente → empieza hoy y los días que quedaban
 *   del anterior se convierten en días del nuevo según la razón de precios;
 * - plan asignado a mano mayor o igual → se mantiene el rango manual y solo
 *   se extiende la membresía;
 * - sin plan → empieza hoy.
 */
export function computePlanPurchase(
  user: PlanUser,
  bought: { code: PlanCode; days: number; priceClp: number },
  currentPlanPriceClp: number | null,
  now = new Date()
): { tier: ProfessionalTier; tierExpiresAt: Date | null; membershipExpiresAt: Date; creditDays: number } {
  const plan = currentPlan(user, now);
  const addDays = (base: Date, days: number) => new Date(base.getTime() + days * DAY_MS);
  const membershipBase =
    user.membershipExpiresAt && user.membershipExpiresAt.getTime() > now.getTime() ? user.membershipExpiresAt : now;
  let membershipExpiresAt = addDays(membershipBase, bought.days);

  if (plan?.manual && PLAN_RANK[plan.code] >= PLAN_RANK[bought.code]) {
    return { tier: planToTier(plan.code), tierExpiresAt: null, membershipExpiresAt, creditDays: 0 };
  }
  // Plan pagado mayor vigente (sólo pasa si un pago de Flow llega después de
  // que la persona ya subió de plan): no se le baja el rango; lo pagado se
  // suma como días de visibilidad.
  if (plan && !plan.manual && PLAN_RANK[plan.code] > PLAN_RANK[bought.code]) {
    if (plan.expiresAt!.getTime() > membershipExpiresAt.getTime()) membershipExpiresAt = plan.expiresAt!;
    return { tier: planToTier(plan.code), tierExpiresAt: plan.expiresAt, membershipExpiresAt, creditDays: 0 };
  }

  let tierExpiresAt: Date;
  let creditDays = 0;
  if (plan && !plan.manual && plan.code === bought.code) {
    tierExpiresAt = addDays(plan.expiresAt!, bought.days);
  } else if (plan && !plan.manual && PLAN_RANK[bought.code] > PLAN_RANK[plan.code]) {
    const remaining = (plan.expiresAt!.getTime() - now.getTime()) / DAY_MS;
    if (currentPlanPriceClp && bought.priceClp > 0) {
      creditDays = Math.floor((remaining * currentPlanPriceClp) / bought.priceClp);
    }
    tierExpiresAt = addDays(now, bought.days + creditDays);
  } else {
    tierExpiresAt = addDays(now, bought.days);
  }
  if (tierExpiresAt.getTime() > membershipExpiresAt.getTime()) membershipExpiresAt = tierExpiresAt;
  return { tier: planToTier(bought.code), tierExpiresAt, membershipExpiresAt, creditDays };
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
      select: { tier: true, tierExpiresAt: true, membershipExpiresAt: true },
    });
    if (!user) throw new Error("USER_NOT_FOUND");

    const plan = currentPlan(user, now);
    let currentPrice: number | null = null;
    if (plan && !plan.manual && plan.code !== product.code) {
      const cur = await tx.promoProduct.findFirst({
        where: { kind: "PLAN", code: plan.code },
        orderBy: { sortOrder: "asc" },
        select: { priceClp: true },
      });
      currentPrice = cur?.priceClp ?? null;
    }

    const r = computePlanPurchase(
      user,
      { code: product.code, days: product.duration, priceClp: product.priceClp },
      currentPrice,
      now
    );
    await tx.user.update({
      where: { id: input.userId },
      data: { tier: r.tier, tierExpiresAt: r.tierExpiresAt, membershipExpiresAt: r.membershipExpiresAt },
    });

    const label = planLabel(product.code);
    const kept = tierToPlan(r.tier);
    const until = r.tierExpiresAt ?? r.membershipExpiresAt;
    const summary =
      kept && kept !== product.code
        ? `Mantienes tu plan ${planLabel(kept)}; sumamos ${product.duration} días de visibilidad (hasta el ${fmtDate(r.membershipExpiresAt)})`
        : `Plan ${label} activo hasta el ${fmtDate(until)}` +
          (r.creditDays > 0 ? ` (incluye ${r.creditDays} días de tu plan anterior)` : "");
    await tx.notification.create({
      data: {
        userId: input.userId,
        type: "SUBSCRIPTION_STARTED",
        data: { title: `Plan ${label} activado`, body: summary, url: "/planes", source: `promo_${input.paidWith.toLowerCase()}` },
      },
    });
    return { summary, endsAt: until };
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
