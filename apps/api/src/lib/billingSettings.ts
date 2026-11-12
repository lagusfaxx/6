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
  /** Días de prueba, contados desde el registro, para quien activa el PAC
   *  (registra su tarjeta en Flow). Si no supera `trialDays`, no hay bono. */
  cardTrialDays: number;
  /** Sistema de prueba con/sin tarjeta (pantalla de elección al registrarse y
   *  bono por tarjeta). Apagado, la prueba es la de siempre desde el registro. */
  trialChoiceEnabled: boolean;
  /** Plan de Flow vigente para el cobro automático (PAC). */
  flowPlanId: string;
  flowPlanPriceClp: number | null;
  /** WhatsApp de UZEED (sólo dígitos, con código de país) donde se envían
   *  los comprobantes de transferencia. Vacío = sin transferencia. */
  receiptWhatsapp: string;
};

export const PAID_PROFILE_TYPES = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const;

const KEYS = {
  enabled: "billing_enabled",
  enabledAt: "billing_enabled_at",
  priceClp: "billing_price_clp",
  graceDays: "billing_grace_days",
  trialDays: "billing_trial_days",
  cardTrialDays: "billing_card_trial_days",
  trialChoiceEnabled: "billing_trial_choice_enabled",
  flowPlanId: "billing_flow_plan_id",
  flowPlanPriceClp: "billing_flow_plan_price_clp",
  receiptWhatsapp: "billing_receipt_whatsapp",
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
    cardTrialDays: config.cardTrialDays,
    trialChoiceEnabled: false,
    flowPlanId: config.flowPlanId,
    flowPlanPriceClp: null,
    receiptWhatsapp: "",
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
    cardTrialDays: toInt(get(KEYS.cardTrialDays), d.cardTrialDays),
    trialChoiceEnabled: get(KEYS.trialChoiceEnabled) === "true",
    flowPlanId: get(KEYS.flowPlanId) || d.flowPlanId,
    flowPlanPriceClp: get(KEYS.flowPlanPriceClp) ? toInt(get(KEYS.flowPlanPriceClp), 0) : null,
    receiptWhatsapp: (get(KEYS.receiptWhatsapp) || "").replace(/\D/g, ""),
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
  Pick<
    BillingSettings,
    "enabled" | "priceClp" | "graceDays" | "trialDays" | "cardTrialDays" | "trialChoiceEnabled" | "flowPlanId" | "flowPlanPriceClp" | "receiptWhatsapp"
  >
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
  if (patch.trialChoiceEnabled !== undefined) {
    writes.push({ key: KEYS.trialChoiceEnabled, value: String(patch.trialChoiceEnabled) });
  }
  if (patch.cardTrialDays !== undefined) {
    writes.push({ key: KEYS.cardTrialDays, value: String(Math.round(patch.cardTrialDays)) });
  }
  if (patch.receiptWhatsapp !== undefined) {
    writes.push({ key: KEYS.receiptWhatsapp, value: patch.receiptWhatsapp.replace(/\D/g, "") });
  }
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
      // Perfil nuevo que no eligió su prueba: apagado hasta que elija (sólo
      // con el sistema 14/30 encendido; apagado, cuenta la prueba de siempre).
      {
        ...(s.trialChoiceEnabled ? { needsTrialChoice: false } : {}),
        OR: [
          { shopTrialEndsAt: { gt: now } },
          { createdAt: { gt: new Date(now.getTime() - s.trialDays * DAY_MS) } },
        ],
      },
    ],
  };
}

/** Envuelve un `where` de usuarios con el filtro de plan, sin pisar sus OR/AND. */
export function withActivePlan<T extends object>(where: T): T {
  const extra = planActiveWhere();
  if (!("OR" in extra)) return where;
  return { AND: [where, extra] } as unknown as T;
}

/**
 * Lo contrario de `planActiveWhere`: perfiles que hoy se exigen plan y no lo
 * tienen (prueba vencida sin pago). Null cuando no se exige plan a nadie.
 * Los listados que los muestran "en gris" lo usan para traerlos aparte.
 */
export function planInactiveWhere(now = new Date()): Prisma.UserWhereInput | null {
  const s = getBillingSettingsSync();
  if (!isBillingEnforced(s, now)) return null;
  // Escrito a mano y no como NOT(planActiveWhere): en SQL, NOT (fecha > hoy)
  // con la fecha en NULL da NULL y la fila se descarta, así que quedaban
  // fuera justo las que nunca pagaron (membershipExpiresAt vacío).
  const trialOver: Prisma.UserWhereInput = {
    AND: [
      { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
      { createdAt: { lte: new Date(now.getTime() - s.trialDays * DAY_MS) } },
    ],
  };
  return {
    AND: [
      { profileType: { in: [...PAID_PROFILE_TYPES] } },
      { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
      s.trialChoiceEnabled ? { OR: [{ needsTrialChoice: true }, trialOver] } : trialOver,
    ],
  };
}

/**
 * Días que un perfil vencido sigue en el directorio "en gris" (fotos visibles,
 * ficha bloqueada) antes de desaparecer si no paga.
 */
export const EXPIRED_GREY_DAYS = 30;
/**
 * Cuándo empezó a mostrarse en gris lo vencido (medianoche de Chile). Las que
 * ya estaban vencidas antes cuentan sus 30 días desde acá y no desde su
 * vencimiento: si no, casi todas habrían desaparecido el mismo día.
 */
export const EXPIRED_GREY_SINCE = new Date("2026-11-12T03:00:00Z");

/**
 * Filtro Prisma de perfiles vencidos que todavía están en sus días en gris:
 * sin plan vigente y con el plan, la prueba o la gracia terminados hace menos
 * de `EXPIRED_GREY_DAYS` (o desde `EXPIRED_GREY_SINCE`). Null si hoy no se
 * exige plan.
 */
export function expiredGreyWhere(now = new Date()): Prisma.UserWhereInput | null {
  const inactive = planInactiveWhere(now);
  if (!inactive) return null;
  const s = getBillingSettingsSync();
  const cutoff = new Date(now.getTime() - EXPIRED_GREY_DAYS * DAY_MS);
  const grace = graceEndsAt(s);
  // El apagado más reciente posible es para todas a la vez: entran todas.
  if (EXPIRED_GREY_SINCE.getTime() > cutoff.getTime() || (grace && grace.getTime() > cutoff.getTime())) {
    return inactive;
  }
  return {
    AND: [
      inactive,
      {
        OR: [
          { membershipExpiresAt: { gt: cutoff } },
          { shopTrialEndsAt: { gt: cutoff } },
          { createdAt: { gt: new Date(cutoff.getTime() - s.trialDays * DAY_MS) } },
        ],
      },
    ],
  };
}

/** ¿Este perfil está vencido y todavía en sus días en gris? */
export async function userInExpiredGrey(userId: string): Promise<boolean> {
  const where = expiredGreyWhere();
  if (!where) return false;
  return (await prisma.user.count({ where: { AND: [{ id: userId }, where] } })) > 0;
}

/**
 * Hasta cuándo un perfil vencido sale en gris: su último día de acceso (plan,
 * prueba o gracia, nunca antes de `EXPIRED_GREY_SINCE`) más `EXPIRED_GREY_DAYS`.
 */
export function expiredGreyUntil(
  user: { membershipExpiresAt: Date | null; shopTrialEndsAt: Date | null; createdAt: Date },
  s: BillingSettings = getBillingSettingsSync()
): Date {
  const end = Math.max(
    user.membershipExpiresAt?.getTime() ?? 0,
    user.shopTrialEndsAt?.getTime() ?? 0,
    user.createdAt.getTime() + s.trialDays * DAY_MS,
    graceEndsAt(s)?.getTime() ?? 0,
    EXPIRED_GREY_SINCE.getTime()
  );
  return new Date(end + EXPIRED_GREY_DAYS * DAY_MS);
}

/**
 * Intentos de abrir la ficha de un perfil sin plan vigente (la tarjeta en gris
 * del directorio), en los últimos `days` días. Los registra
 * POST /professionals/:id/locked-view como UserAction "locked_profile_view".
 */
export async function countLockedProfileViews(userId: string, days = 30): Promise<number> {
  return prisma.userAction
    .count({
      where: {
        action: "locked_profile_view",
        targetId: userId,
        createdAt: { gt: new Date(Date.now() - days * DAY_MS) },
      },
    })
    .catch(() => 0);
}

/** Igual que `withActivePlan`, para filtros anidados en la relación con el autor/dueño. */
export function activePlanRelationWhere(): Prisma.UserWhereInput | undefined {
  const extra = planActiveWhere();
  return "OR" in extra ? extra : undefined;
}

/**
 * Desde cuándo se cuentan los días de un pago de membresía: lo más tarde entre
 * hoy, el vencimiento vigente y el fin de la gracia general. Así quien paga
 * durante la gracia (p. ej. avisos desde el 2/10 y cobro desde el 5/11) no
 * pierde días: su mes empieza cuando termina la gracia.
 */
export function membershipRenewalBase(current: Date | null | undefined, now = new Date()): Date {
  const s = getBillingSettingsSync();
  const grace = s.enabled ? graceEndsAt(s) : null;
  return new Date(Math.max(now.getTime(), current?.getTime() ?? 0, grace?.getTime() ?? 0));
}

/** Días que le quedan a un perfil de acceso gratis/pagado (0 si ninguno). */
export function remainingAccessDays(
  user: { membershipExpiresAt: Date | null; shopTrialEndsAt: Date | null; createdAt?: Date | null; needsTrialChoice?: boolean },
  now = new Date()
): number {
  const s = getBillingSettingsSync();
  // Sin elegir su prueba sólo cuenta una membresía pagada.
  const candidates = user.needsTrialChoice && s.trialChoiceEnabled
    ? [user.membershipExpiresAt?.getTime() ?? 0]
    : [
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

/**
 * Fin de la prueba extendida por activar el PAC: `cardTrialDays` contados
 * desde el registro. Se ancla a `createdAt`, así que activar, cancelar y
 * volver a activar nunca suma días: el tope es siempre el mismo.
 * Devuelve null si no hay bono (desactivado o no supera la prueba normal).
 */
export function cardTrialEndsAt(
  user: { createdAt?: Date | null; trialStartedAt?: Date | null; needsTrialChoice?: boolean },
  s: BillingSettings = getBillingSettingsSync(),
  now = new Date()
): Date | null {
  if (!s.trialChoiceEnabled || s.cardTrialDays <= s.trialDays) return null;
  // Los días se cuentan desde que eligió su prueba (perfiles nuevos) o desde
  // el registro (perfiles anteriores a la elección). Si todavía no elige,
  // contarían desde hoy.
  const anchor = user.needsTrialChoice ? now : user.trialStartedAt ?? user.createdAt;
  if (!anchor) return null;
  return new Date(anchor.getTime() + s.cardTrialDays * DAY_MS);
}

/** Datos que se graban al elegir la prueba (con o sin tarjeta). */
export function trialChoiceData(now = new Date(), s: BillingSettings = getBillingSettingsSync()) {
  return {
    needsTrialChoice: false,
    trialStartedAt: now,
    shopTrialEndsAt: new Date(now.getTime() + s.trialDays * DAY_MS),
  };
}

/**
 * ¿Este perfil nuevo tiene que elegir su prueba al crearse? Sí para
 * profesionales, locales y tiendas con el cobro encendido, salvo que ya
 * vengan con membresía pagada (Gold al registrarse).
 */
export async function requiresTrialChoice(profileType: string, hasPaidMembership = false): Promise<boolean> {
  const s = await getBillingSettings();
  return s.enabled && s.trialChoiceEnabled && !hasPaidMembership && (PAID_PROFILE_TYPES as readonly string[]).includes(profileType);
}

/**
 * Días de prueba que se le pasan a Flow al crear la suscripción PAC: lo que le
 * queda de acceso o, si es mayor, lo que le falta para cumplir la prueba con
 * tarjeta. `bonusDays` es lo que gana por activar el PAC (0 si nada).
 */
export function pacTrialDays(
  user: {
    membershipExpiresAt: Date | null;
    shopTrialEndsAt: Date | null;
    createdAt?: Date | null;
    trialStartedAt?: Date | null;
    needsTrialChoice?: boolean;
  },
  now = new Date()
): { trialDays: number; bonusDays: number; bonusEndsAt: Date | null } {
  const remaining = remainingAccessDays(user, now);
  const end = cardTrialEndsAt(user, getBillingSettingsSync(), now);
  const untilBonus = end && end.getTime() > now.getTime() ? Math.ceil((end.getTime() - now.getTime()) / DAY_MS) : 0;
  return {
    trialDays: Math.max(remaining, untilBonus),
    bonusDays: Math.max(0, untilBonus - remaining),
    bonusEndsAt: untilBonus > remaining ? end : null,
  };
}

/*
 * Registro del PAC. Va en ReminderLog y no en las notificaciones porque la
 * usuaria puede borrar todas sus notificaciones desde la app: con eso podía
 * hacer desaparecer la marca de "prueba con bono" y quedarse con los días al
 * cancelar, o la de "ya cobrado" y cortar sus renovaciones.
 */
type Db = Pick<typeof prisma, "reminderLog">;

const PAC_CHARGED = (subscriptionId: string) => `pac_charged:${subscriptionId}`;
const PAC_TRIAL_PREFIX = (subscriptionId: string) => `pac_trial:${subscriptionId}:`;

/** Marca que Flow cobró esta suscripción (webhook, /start o sync). */
export async function markPacCharge(userId: string, subscriptionId: string, db: Db = prisma): Promise<void> {
  const type = PAC_CHARGED(subscriptionId);
  await db.reminderLog.upsert({
    where: { userId_type: { userId, type } },
    update: {},
    create: { userId, type },
  });
}

/** Guarda la prueba PAC con bono y la membresía que tenía antes, para deshacerla si cancela. */
export async function markPacTrial(
  userId: string,
  subscriptionId: string,
  bonusDays: number,
  previousExpiry: Date | null,
  db: Db = prisma
): Promise<void> {
  const type = `${PAC_TRIAL_PREFIX(subscriptionId)}${bonusDays}:${previousExpiry ? previousExpiry.getTime() : "none"}`;
  await db.reminderLog.upsert({
    where: { userId_type: { userId, type } },
    update: {},
    create: { userId, type },
  });
}

/** Lee la prueba PAC guardada por `markPacTrial` (null si no hay). */
export async function getPacTrial(
  userId: string,
  subscriptionId: string
): Promise<{ bonusDays: number; previousExpiry: Date | null } | null> {
  const prefix = PAC_TRIAL_PREFIX(subscriptionId);
  const row = await prisma.reminderLog.findFirst({
    where: { userId, type: { startsWith: prefix } },
    orderBy: { createdAt: "desc" },
    select: { type: true },
  });
  if (!row) return null;
  const [bonus, prev] = row.type.slice(prefix.length).split(":");
  const ms = Number(prev);
  return {
    bonusDays: Number(bonus) || 0,
    previousExpiry: prev && prev !== "none" && Number.isFinite(ms) ? new Date(ms) : null,
  };
}

/**
 * ¿La suscripción de Flow sigue en su periodo de prueba? Un aviso de Flow con
 * la prueba corriendo no es un cobro y no debe sumar un mes. Si Flow no trae la
 * fecha o no se entiende, se asume que no (se comporta como antes).
 */
export function flowTrialRunning(sub: { trial_end?: string | null }, now = new Date()): boolean {
  if (!sub.trial_end) return false;
  const end = new Date(String(sub.trial_end).replace(" ", "T"));
  if (Number.isNaN(end.getTime())) return false;
  // Margen de un día por la zona horaria con que Flow informa la fecha.
  return end.getTime() - now.getTime() > 24 * 60 * 60 * 1000;
}

/** Fuentes de notificación que significan "Flow cobró esta suscripción" (registro antiguo). */
export const PAC_CHARGE_SOURCES = ["flow_subscription", "flow_subscription_token", "flow_pac_charged", "pac_sync_worker"];

/**
 * ¿Flow ya cobró al menos una vez esta suscripción PAC? Mira el registro del
 * PAC y, para suscripciones anteriores a él, las notificaciones de renovación.
 */
export async function hasPacCharge(userId: string, subscriptionId: string): Promise<boolean> {
  const marked = await prisma.reminderLog.findUnique({
    where: { userId_type: { userId, type: PAC_CHARGED(subscriptionId) } },
    select: { id: true },
  });
  if (marked) return true;
  const n = await prisma.notification.count({
    where: {
      userId,
      type: "SUBSCRIPTION_RENEWED",
      AND: [
        { data: { path: ["subscriptionId"], equals: subscriptionId } },
        { OR: PAC_CHARGE_SOURCES.map((source) => ({ data: { path: ["source"], equals: source } })) },
      ],
    },
  });
  return n > 0;
}

/** ¿Este perfil tiene pendiente elegir su prueba? (Falso con el sistema 14/30 apagado.) */
export function pendingTrialChoice(user: { needsTrialChoice?: boolean | null }, s: BillingSettings = getBillingSettingsSync()): boolean {
  return Boolean(user.needsTrialChoice && s.enabled && s.trialChoiceEnabled);
}
