/**
 * Planes, límites, precios y cobro en tokens de Acompañantes IA.
 *
 * Los precios viven en PlatformConfig (claves ai_*) para ajustarlos desde el
 * panel cuando se mida el costo real de inferencia; los valores de aquí son
 * sólo el punto de partida.
 */
import type { AiCompanionAccess, AiCompanionPlanTier, Prisma } from "@prisma/client";
import { prisma } from "../db";
import { chileStartOfToday } from "../lib/chileTime";

export type TierLimits = {
  /** Mensajes del usuario por día (hora de Chile), sumando todos los personajes. */
  dailyMessages: number;
  /** Recuerdos guardados por personaje. */
  memoryLimit: number;
  /** Mensajes recientes que se le pasan al modelo como contexto. */
  contextMessages: number;
  /** Si la IA extrae recuerdos y resume sola. */
  autoMemory: boolean;
};

export const TIER_LIMITS: Record<AiCompanionPlanTier, TierLimits> = {
  FREE: { dailyMessages: 25, memoryLimit: 10, contextMessages: 12, autoMemory: false },
  PREMIUM: { dailyMessages: 300, memoryLimit: 60, contextMessages: 30, autoMemory: true },
  VIP: { dailyMessages: 1500, memoryLimit: 200, contextMessages: 50, autoMemory: true },
};

export const PRICE_DEFAULTS = {
  ai_plan_premium_tokens: 10,
  ai_plan_vip_tokens: 25,
  ai_plan_days: 30,
  ai_image_tokens: 2,
  ai_image_tokens_vip: 1,
} as const;

export type PriceKey = keyof typeof PRICE_DEFAULTS;
export type Prices = Record<PriceKey, number>;

export async function getPrices(): Promise<Prices> {
  const rows = await prisma.platformConfig.findMany({
    where: { key: { in: Object.keys(PRICE_DEFAULTS) } },
  });
  const out = { ...PRICE_DEFAULTS } as Prices;
  for (const r of rows) {
    const n = parseInt(r.value, 10);
    if (Number.isFinite(n) && n >= 0) out[r.key as PriceKey] = n;
  }
  return out;
}

export async function setPrices(patch: Partial<Prices>): Promise<Prices> {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in PRICE_DEFAULTS)) continue;
    const n = Math.floor(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > 100_000) continue;
    await prisma.platformConfig.upsert({
      where: { key },
      create: { key, value: String(n) },
      update: { value: String(n) },
    });
  }
  return getPrices();
}

export async function getOrCreateAccount(userId: string) {
  return prisma.aiCompanionAccount.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });
}

export function effectiveTier(account: { tier: AiCompanionPlanTier; tierExpiresAt: Date | null }): AiCompanionPlanTier {
  if (account.tier === "FREE") return "FREE";
  if (!account.tierExpiresAt || account.tierExpiresAt.getTime() < Date.now()) return "FREE";
  return account.tier;
}

export function imagePrice(tier: AiCompanionPlanTier, prices: Prices): number {
  return tier === "VIP" ? prices.ai_image_tokens_vip : prices.ai_image_tokens;
}

export async function hasActiveUnlock(userId: string, companionId: string): Promise<boolean> {
  const u = await prisma.aiCompanionUnlock.findUnique({
    where: { userId_companionId: { userId, companionId } },
    select: { expiresAt: true },
  });
  return Boolean(u && u.expiresAt.getTime() > Date.now());
}

/** ¿Puede el usuario chatear con este personaje con su plan actual? */
export async function canUseCompanion(
  userId: string,
  tier: AiCompanionPlanTier,
  companion: { id: string; access: AiCompanionAccess },
): Promise<boolean> {
  switch (companion.access) {
    case "FREE":
      return true;
    case "PREMIUM":
      return tier === "PREMIUM" || tier === "VIP";
    case "VIP":
      return tier === "VIP";
    case "EXCLUSIVE":
      return tier === "VIP" || (await hasActiveUnlock(userId, companion.id));
  }
}

export async function messagesSentToday(userId: string): Promise<number> {
  return prisma.aiCompanionMessage.count({
    where: {
      role: "USER",
      // Los pedidos de imagen llevan imageId: se cobran en tokens, no cuentan aquí.
      imageId: null,
      createdAt: { gte: chileStartOfToday() },
      chat: { userId },
    },
  });
}

export class InsufficientTokensError extends Error {
  constructor(public needed: number, public balance: number) {
    super("INSUFFICIENT_TOKENS");
  }
}

/**
 * Descuenta tokens dentro de una transacción. La condición `balance >= amount`
 * va en el mismo UPDATE, así dos cobros simultáneos no dejan saldo negativo.
 */
export async function debitTokens(
  tx: Prisma.TransactionClient,
  params: { userId: string; amount: number; description: string; referenceId?: string | null },
): Promise<number> {
  if (params.amount <= 0) return -1;
  const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
  if (!wallet) throw new InsufficientTokensError(params.amount, 0);

  const updated = await tx.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: params.amount } },
    data: { balance: { decrement: params.amount }, totalSpent: { increment: params.amount } },
  });
  if (updated.count === 0) throw new InsufficientTokensError(params.amount, wallet.balance);

  const after = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id }, select: { balance: true } });
  await tx.tokenTransaction.create({
    data: {
      walletId: wallet.id,
      type: "AI_COMPANION",
      amount: -params.amount,
      balance: after.balance,
      referenceId: params.referenceId || null,
      description: params.description,
    },
  });
  return after.balance;
}

/** Devuelve tokens (p. ej. si falló la generación de una imagen ya cobrada). */
export async function refundTokens(params: {
  userId: string;
  amount: number;
  description: string;
  referenceId?: string | null;
}): Promise<void> {
  if (params.amount <= 0) return;
  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId: params.userId } });
    if (!wallet) return;
    const after = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: params.amount }, totalSpent: { decrement: params.amount } },
      select: { balance: true },
    });
    await tx.tokenTransaction.create({
      data: {
        walletId: wallet.id,
        type: "AI_COMPANION",
        amount: params.amount,
        balance: after.balance,
        referenceId: params.referenceId || null,
        description: params.description,
      },
    });
  });
}

/** Edad cumplida a partir de la fecha de nacimiento. */
export function ageFromBirthdate(birthdate: Date, now = new Date()): number {
  let age = now.getFullYear() - birthdate.getFullYear();
  const m = now.getMonth() - birthdate.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birthdate.getDate())) age--;
  return age;
}
