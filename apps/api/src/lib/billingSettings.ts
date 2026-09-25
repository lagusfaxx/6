import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config";

/**
 * Configuración del cobro de membresías, editable desde el panel
 * (/admin/cobros) y guardada en PlatformConfig.
 *
 * Con el interruptor APAGADO nadie paga: todos los perfiles se ven, aunque
 * su prueba haya vencido, y los pagos se rechazan. No se toca ningún dato de
 * los perfiles, así que al encenderlo cada uno queda como estaba.
 *
 * Al ENCENDERLO se guarda la fecha (`enabledAt`) y todos los perfiles sin plan
 * vigente reciben `graceDays` de gracia contados desde ese momento. Pasada la
 * gracia, los perfiles sin membresía ni prueba vigente dejan de mostrarse en
 * el sitio hasta que paguen.
 */
export type BillingSettings = {
  enabled: boolean;
  enabledAt: Date | null;
  priceClp: number;
  graceDays: number;
  trialDays: number;
  /** Plan de Flow vigente para el cobro automático (PAC). */
  flowPlanId: string;
  flowPlanPriceClp: number | null;
};

export const PAID_PROFILE_TYPES = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const;

const KEYS = {
  enabled: "billing_enabled",
  enabledAt: "billing_enabled_at",
  priceClp: "billing_price_clp",
  graceDays: "billing_grace_days",
  trialDays: "billing_trial_days",
  flowPlanId: "billing_flow_plan_id",
  flowPlanPriceClp: "billing_flow_plan_price_clp",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30_000;

function defaults(): BillingSettings {
  return {
    enabled: false,
    enabledAt: null,
    priceClp: config.membershipPriceClp,
    graceDays: 7,
    trialDays: config.freeTrialDays,
    flowPlanId: config.flowPlanId,
    flowPlanPriceClp: null,
  };
}

let cache: BillingSettings = defaults();
let loadedAt = 0;
let inflight: Promise<BillingSettings> | null = null;

function toInt(value: string | undefined, fallback: number, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? Math.round(n) : fallback;
}

async function readFromDb(): Promise<BillingSettings> {
  const [rows, silver] = await Promise.all([
    prisma.platformConfig.findMany({
      where: { key: { in: Object.values(KEYS) } },
    }),
    // La tarifa de membresía es el precio del plan Silver del catálogo.
    prisma.promoProduct
      .findFirst({ where: { kind: "PLAN", code: "SILVER", isActive: true }, orderBy: { sortOrder: "asc" }, select: { priceClp: true } })
      .catch(() => null),
  ]);
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  const d = defaults();
  const enabledAtRaw = get(KEYS.enabledAt);
  const enabledAt = enabledAtRaw ? new Date(enabledAtRaw) : null;
  return {
    enabled: get(KEYS.enabled) === "true",
    enabledAt: enabledAt && !Number.isNaN(enabledAt.getTime()) ? enabledAt : null,
    priceClp: silver?.priceClp ?? toInt(get(KEYS.priceClp), d.priceClp, 1),
    graceDays: toInt(get(KEYS.graceDays), d.graceDays),
    trialDays: toInt(get(KEYS.trialDays), d.trialDays),
    flowPlanId: get(KEYS.flowPlanId) || d.flowPlanId,
    flowPlanPriceClp: get(KEYS.flowPlanPriceClp) ? toInt(get(KEYS.flowPlanPriceClp), 0) : null,
  };
}

/** Lee la configuración (con caché de 30 s). */
export async function getBillingSettings(force = false): Promise<BillingSettings> {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return cache;
  if (!inflight) {
    inflight = readFromDb()
      .then((s) => {
        cache = s;
        loadedAt = Date.now();
        return s;
      })
      .catch((err) => {
        console.error("[billing] no se pudo leer la configuración de cobro", err?.message || err);
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/**
 * Última configuración conocida, sin esperar a la base. La usan los filtros
 * síncronos; se refresca sola en segundo plano. Antes de la primera lectura
 * devuelve los valores por defecto (cobro apagado: se muestra todo).
 */
export function getBillingSettingsSync(): BillingSettings {
  if (Date.now() - loadedAt >= REFRESH_MS) void getBillingSettings();
  return cache;
}

export type BillingSettingsPatch = Partial<
  Pick<BillingSettings, "enabled" | "priceClp" | "graceDays" | "trialDays" | "flowPlanId" | "flowPlanPriceClp">
>;

export async function updateBillingSettings(patch: BillingSettingsPatch): Promise<BillingSettings> {
  const current = await getBillingSettings(true);
  const writes: { key: string; value: string }[] = [];

  if (patch.enabled !== undefined && patch.enabled !== current.enabled) {
    writes.push({ key: KEYS.enabled, value: String(patch.enabled) });
    // La gracia se cuenta desde que se enciende el cobro.
    if (patch.enabled) writes.push({ key: KEYS.enabledAt, value: new Date().toISOString() });
  }
  if (patch.priceClp !== undefined) {
    writes.push({ key: KEYS.priceClp, value: String(Math.round(patch.priceClp)) });
    await prisma.promoProduct
      .updateMany({ where: { kind: "PLAN", code: "SILVER" }, data: { priceClp: Math.round(patch.priceClp) } })
      .catch(() => undefined);
  }
  if (patch.graceDays !== undefined) writes.push({ key: KEYS.graceDays, value: String(Math.round(patch.graceDays)) });
  if (patch.trialDays !== undefined) writes.push({ key: KEYS.trialDays, value: String(Math.round(patch.trialDays)) });
  if (patch.flowPlanId !== undefined) writes.push({ key: KEYS.flowPlanId, value: patch.flowPlanId });
  if (patch.flowPlanPriceClp !== undefined && patch.flowPlanPriceClp !== null) {
    writes.push({ key: KEYS.flowPlanPriceClp, value: String(patch.flowPlanPriceClp) });
  }

  if (writes.length) {
    await prisma.$transaction(
      writes.map((w) =>
        prisma.platformConfig.upsert({
          where: { key: w.key },
          create: { key: w.key, value: w.value },
          update: { value: w.value },
        })
      )
    );
  }
  return getBillingSettings(true);
}

/** Fin de la gracia general que se da al encender el cobro (null si no aplica). */
export function graceEndsAt(s: BillingSettings = getBillingSettingsSync()): Date | null {
  if (!s.enabled || !s.enabledAt) return null;
  return new Date(s.enabledAt.getTime() + s.graceDays * DAY_MS);
}

/** ¿Hoy se le exige plan a alguien? Falso con el cobro apagado o durante la gracia. */
export function isBillingEnforced(s: BillingSettings = getBillingSettingsSync(), now = new Date()): boolean {
  if (!s.enabled) return false;
  const grace = graceEndsAt(s);
  return !grace || grace.getTime() <= now.getTime();
}

/**
 * Filtro Prisma de "perfil con plan vigente" para listados públicos.
 * Devuelve `{}` cuando no se exige plan (cobro apagado o en gracia).
 */
export function planActiveWhere(now = new Date()): Prisma.UserWhereInput {
  const s = getBillingSettingsSync();
  if (!isBillingEnforced(s, now)) return {};
  return {
    OR: [
      { profileType: { notIn: [...PAID_PROFILE_TYPES] } },
      { membershipExpiresAt: { gt: now } },
      { shopTrialEndsAt: { gt: now } },
      { createdAt: { gt: new Date(now.getTime() - s.trialDays * DAY_MS) } },
    ],
  };
}

/** Envuelve un `where` de usuarios con el filtro de plan, sin pisar sus OR/AND. */
export function withActivePlan<T extends object>(where: T): T {
  const extra = planActiveWhere();
  if (!("OR" in extra)) return where;
  return { AND: [where, extra] } as unknown as T;
}

/** Igual que `withActivePlan`, para filtros anidados en la relación con el autor/dueño. */
export function activePlanRelationWhere(): Prisma.UserWhereInput | undefined {
  const extra = planActiveWhere();
  return "OR" in extra ? extra : undefined;
}

/** Días que le quedan a un perfil de acceso gratis/pagado (0 si ninguno). */
export function remainingAccessDays(
  user: { membershipExpiresAt: Date | null; shopTrialEndsAt: Date | null; createdAt?: Date | null },
  now = new Date()
): number {
  const s = getBillingSettingsSync();
  const candidates = [
    user.membershipExpiresAt?.getTime() ?? 0,
    user.shopTrialEndsAt?.getTime() ?? 0,
    user.createdAt ? user.createdAt.getTime() + s.trialDays * DAY_MS : 0,
    graceEndsAt(s)?.getTime() ?? 0,
  ];
  const end = Math.max(...candidates);
  return end > now.getTime() ? Math.ceil((end - now.getTime()) / DAY_MS) : 0;
}

/** ¿Este perfil tiene plan vigente? Siempre verdadero si hoy no se exige plan. */
export async function userHasActivePlan(userId: string): Promise<boolean> {
  const extra = planActiveWhere();
  if (!("OR" in extra)) return true;
  const n = await prisma.user.count({ where: { AND: [{ id: userId }, extra] } });
  return n > 0;
}
