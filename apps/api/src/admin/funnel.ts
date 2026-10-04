import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { CHILE_TZ } from "../lib/chileTime";
import { getBillingSettings, graceEndsAt, isBillingEnforced } from "../lib/billingSettings";
import { MIN_PROFILE_PHOTOS, missingProfileFields } from "../lib/profileCompletion";
import { organicSignupWhere, realActionSql, TEST_EMAIL_SUFFIX } from "../lib/statsFilters";

/**
 * Embudo de ventas de los anunciantes (profesionales, locales y tiendas).
 *
 * Responde tres preguntas para decidir cuánto cobrar y a quién empujar:
 *  1. ¿Dónde se quedan? Registro → ficha publicada → fotos → ficha completa →
 *     verificada → recibe contactos → intenta pagar → paga → renueva.
 *  2. ¿Quién no paga? Foto actual: pagando, en prueba, prueba vencida sin
 *     pagar nunca, ex pagadoras y pagos que se intentaron y no se cerraron.
 *  3. ¿Cuánto valen? Contactos que recibe un perfil al mes, tarifa de las
 *     profesionales, MRR, churn, LTV y precios que ya se cobraron con su
 *     conversión, para simular otro precio.
 *
 * Sólo registros orgánicos (sin perfiles cargados por el equipo, de prueba ni
 * cuentas del equipo). Es estrategia de precio y trae teléfonos: sólo el
 * administrador (ver MODERATOR_BLOCKED_PREFIXES).
 */
export const adminFunnelRouter = Router();

adminFunnelRouter.use("/funnel", requireAdmin);

const DAY_MS = 24 * 60 * 60 * 1000;
const PLAN_PURPOSES = ["MEMBERSHIP_PLAN", "SHOP_PLAN"] as const;
const BUSINESS_TYPES = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const;
type BusinessType = (typeof BUSINESS_TYPES)[number];
const CONTACT_ACTIONS = ["whatsapp_click", "phone_click"];
/** Un pago PENDING más viejo que esto ya no se va a cerrar solo: se abandonó. */
const ABANDON_MS = 60 * 60 * 1000;

export type FunnelOptions = { days: number; profileType: BusinessType | "ALL" };

export function parseFunnelOptions(query: Record<string, unknown>): FunnelOptions {
  const days = Math.min(Math.max(Math.round(Number(query.days) || 90), 7), 365);
  const raw = String(query.profileType || "PROFESSIONAL").toUpperCase();
  const profileType = raw === "ALL" || (BUSINESS_TYPES as readonly string[]).includes(raw) ? (raw as FunnelOptions["profileType"]) : "PROFESSIONAL";
  return { days, profileType };
}

function typesOf(opts: FunnelOptions): BusinessType[] {
  return opts.profileType === "ALL" ? [...BUSINESS_TYPES] : [opts.profileType];
}

/** Lo mismo que `organicSignupWhere`, en SQL, para las consultas agregadas. */
function organicUserSql(alias: string, types: BusinessType[]): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`(
    ${a}."profileType"::text IN (${Prisma.join(types)})
    AND ${a}."adminManaged" = false
    AND ${a}."email" NOT LIKE ${"%" + TEST_EMAIL_SUFFIX}
    AND ${a}."email" <> ${config.adminEmail}
    AND ${a}."role" NOT IN ('ADMIN', 'MODERATOR')
  )`;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;
}

function chunk<T>(items: T[], size = 5000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const profileSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  phone: true,
  city: true,
  avatarUrl: true,
  profileType: true,
  signupSource: true,
  createdAt: true,
  lastSeen: true,
  isActive: true,
  isVerified: true,
  verificationRejectedAt: true,
  profileCompletedAt: true,
  membershipExpiresAt: true,
  shopTrialEndsAt: true,
  flowSubscriptionId: true,
  birthdate: true,
  heightCm: true,
  weightKg: true,
  measurements: true,
  hairColor: true,
  skinTone: true,
  baseRate: true,
  bio: true,
  serviceTags: true,
  undisclosedFields: true,
  _count: { select: { profileMedia: { where: { type: "IMAGE" } } } },
} satisfies Prisma.UserSelect;

type ProfileRow = Prisma.UserGetPayload<{ select: typeof profileSelect }>;

type IntentStats = {
  total: number;
  paid: number;
  firstPaidAt: Date | null;
  lastPaidAt: Date | null;
  /** Último intento sin pagar posterior al último pago (o sin pagos). */
  openAttempt: { status: string; method: string; amount: number; createdAt: Date } | null;
};

type Activity = { contacts: number; conversations: number };

/** Contactos (WhatsApp/teléfono, uno por persona y día) y conversaciones recibidas desde `since`. */
async function activityByProfile(ids: string[], since: Date): Promise<Map<string, Activity>> {
  const map = new Map<string, Activity>();
  for (const part of chunk(ids)) {
    const [contacts, conversations] = await Promise.all([
      prisma.$queryRaw<{ id: string; n: number }[]>`
        SELECT ua."targetId"::text AS id,
          COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text)
            || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${CHILE_TZ}, 'YYYY-MM-DD')))::int AS n
        FROM "UserAction" ua
        WHERE ua."targetId" = ANY(${part}::uuid[]) AND ua."action" IN (${Prisma.join(CONTACT_ACTIONS)})
          AND ua."createdAt" >= ${since} AND ${realActionSql("ua")}
        GROUP BY 1`,
      prisma.$queryRaw<{ id: string; n: number }[]>`
        SELECT m."toId"::text AS id, COUNT(DISTINCT m."fromId")::int AS n
        FROM "Message" m
        WHERE m."toId" = ANY(${part}::uuid[]) AND m."createdAt" >= ${since}
        GROUP BY 1`,
    ]);
    for (const r of contacts) map.set(r.id, { contacts: r.n, conversations: 0 });
    for (const r of conversations) {
      const cur = map.get(r.id) ?? { contacts: 0, conversations: 0 };
      cur.conversations = r.n;
      map.set(r.id, cur);
    }
  }
  return map;
}

async function intentsByProfile(ids: string[]): Promise<Map<string, IntentStats>> {
  const map = new Map<string, IntentStats>();
  for (const part of chunk(ids)) {
    const rows = await prisma.paymentIntent.findMany({
      where: { subscriberId: { in: part }, purpose: { in: [...PLAN_PURPOSES] } },
      orderBy: { createdAt: "asc" },
      select: { subscriberId: true, status: true, method: true, amount: true, createdAt: true, paidAt: true },
    });
    for (const r of rows) {
      const s = map.get(r.subscriberId) ?? { total: 0, paid: 0, firstPaidAt: null, lastPaidAt: null, openAttempt: null };
      s.total += 1;
      if (r.status === "PAID") {
        s.paid += 1;
        const at = r.paidAt ?? r.createdAt;
        if (!s.firstPaidAt) s.firstPaidAt = at;
        s.lastPaidAt = at;
        s.openAttempt = null;
      } else {
        s.openAttempt = { status: r.status, method: r.method, amount: r.amount, createdAt: r.createdAt };
      }
      map.set(r.subscriberId, s);
    }
  }
  return map;
}

function photoCount(p: ProfileRow): number {
  return p._count.profileMedia;
}

/** Qué le falta a la ficha. Locales y tiendas no tienen datos físicos: basta comuna, número y una foto. */
function missingFor(p: ProfileRow): string[] {
  if (p.profileType === "PROFESSIONAL") return missingProfileFields(p, photoCount(p)).map((f) => f.label);
  const out: string[] = [];
  if (photoCount(p) < 1 && !p.avatarUrl) out.push("Al menos 1 foto");
  if (!p.city) out.push("Comuna");
  if (!p.phone) out.push("Número de WhatsApp");
  return out;
}

function hasPhotos(p: ProfileRow): boolean {
  return p.profileType === "PROFESSIONAL" ? photoCount(p) >= MIN_PROFILE_PHOTOS : photoCount(p) >= 1 || Boolean(p.avatarUrl);
}

function trialEndOf(p: { createdAt: Date; shopTrialEndsAt: Date | null }, trialDays: number): Date {
  return new Date(Math.max(p.shopTrialEndsAt?.getTime() ?? 0, p.createdAt.getTime() + trialDays * DAY_MS));
}

const STAGES = [
  { key: "registro", label: "Se registró", hint: "Creó la cuenta como anunciante." },
  { key: "publicada", label: "Publicó su ficha", hint: "Guardó la ficha al menos una vez (sale al aire al primer guardado)." },
  { key: "fotos", label: "Subió fotos", hint: `Al menos ${MIN_PROFILE_PHOTOS} fotos (locales y tiendas: 1).` },
  { key: "completa", label: "Ficha completa", hint: "Sin datos pendientes (cuenta “prefiero no decirlo”)." },
  { key: "verificada", label: "Verificada", hint: "Aprobada por el equipo." },
  { key: "contactada", label: "Recibió contactos", hint: "Al menos un WhatsApp, llamada o mensaje de un cliente." },
  { key: "intento", label: "Intentó pagar", hint: "Abrió el pago de la membresía (Flow o transferencia)." },
  { key: "pago", label: "Pagó", hint: "Al menos un pago de membresía aprobado." },
  { key: "renovo", label: "Renovó", hint: "Dos pagos o más: se quedó." },
] as const;
type StageKey = (typeof STAGES)[number]["key"];

/** Lo usa también el servidor MCP, por eso vive aparte del handler. */
export async function buildSalesFunnel(opts: FunnelOptions) {
  const now = new Date();
  const types = typesOf(opts);
  const billing = await getBillingSettings();
  const price = billing.priceClp;
  const from = new Date(now.getTime() - opts.days * DAY_MS);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const organic = organicUserSql("u", types);

  // ── 1. Cohorte: registros orgánicos del periodo, etapa por etapa ──
  const cohort = await prisma.user.findMany({
    where: { AND: [organicSignupWhere(), { profileType: { in: types }, createdAt: { gte: from } }] },
    select: profileSelect,
    take: 20000,
  });
  const cohortIds = cohort.map((p) => p.id);
  const [cohortActivity, cohortIntents] = await Promise.all([
    activityByProfile(cohortIds, new Date(0)),
    intentsByProfile(cohortIds),
  ]);

  const flagsOf = (p: ProfileRow): Record<StageKey, boolean> => {
    const act = cohortActivity.get(p.id);
    const ints = cohortIntents.get(p.id);
    return {
      registro: true,
      publicada: Boolean(p.profileCompletedAt),
      fotos: hasPhotos(p),
      completa: missingFor(p).length === 0,
      verificada: p.isVerified,
      contactada: Boolean(act && (act.contacts > 0 || act.conversations > 0)),
      intento: Boolean(ints && ints.total > 0),
      pago: Boolean(ints && ints.paid > 0),
      renovo: Boolean(ints && ints.paid > 1),
    };
  };

  const sequential = Object.fromEntries(STAGES.map((s) => [s.key, 0])) as Record<StageKey, number>;
  const independent = { ...sequential };
  const stuckAt = { ...sequential };
  const bySource = new Map<string, { registros: number; publicadas: number; verificadas: number; pagaron: number }>();
  const daysToPay: number[] = [];
  let trialEnded = 0;
  let trialEndedPaid = 0;

  for (const p of cohort) {
    const flags = flagsOf(p);
    let chain = true;
    let stuck: StageKey | null = null;
    for (const s of STAGES) {
      if (flags[s.key]) independent[s.key] += 1;
      chain = chain && flags[s.key];
      if (chain) sequential[s.key] += 1;
      else if (!stuck) stuck = s.key;
    }
    if (stuck) stuckAt[stuck] += 1;

    const src = p.signupSource || "sin dato";
    const row = bySource.get(src) ?? { registros: 0, publicadas: 0, verificadas: 0, pagaron: 0 };
    row.registros += 1;
    if (flags.publicada) row.publicadas += 1;
    if (flags.verificada) row.verificadas += 1;
    if (flags.pago) row.pagaron += 1;
    bySource.set(src, row);

    const firstPaid = cohortIntents.get(p.id)?.firstPaidAt;
    if (firstPaid) daysToPay.push(Math.max(0, Math.round((firstPaid.getTime() - p.createdAt.getTime()) / DAY_MS)));
    if (trialEndOf(p, billing.trialDays).getTime() <= now.getTime()) {
      trialEnded += 1;
      if (flags.pago) trialEndedPaid += 1;
    }
  }

  const total = cohort.length;
  const stages = STAGES.map((s, i) => {
    const prev = i === 0 ? total : sequential[STAGES[i - 1].key];
    return {
      key: s.key,
      label: s.label,
      hint: s.hint,
      count: sequential[s.key],
      pctOfTotal: pct(sequential[s.key], total),
      pctOfPrevious: pct(sequential[s.key], prev),
      dropFromPrevious: prev - sequential[s.key],
      independent: independent[s.key],
      stuckHere: stuckAt[s.key],
    };
  });

  // ── 2. Foto actual de pago (toda la base de anunciantes, no sólo la cohorte) ──
  const trialSql = Prisma.sql`GREATEST(COALESCE(u."shopTrialEndsAt", u."createdAt"), u."createdAt" + make_interval(days => ${billing.trialDays}::int))`;
  const everPaid = Prisma.sql`EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = u."id" AND pi."status" = 'PAID' AND pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)}))`;
  const openAttempt = Prisma.sql`EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = u."id" AND pi."status" <> 'PAID' AND pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)})
      AND NOT EXISTS (SELECT 1 FROM "PaymentIntent" p2 WHERE p2."subscriberId" = u."id" AND p2."status" = 'PAID' AND p2."createdAt" > pi."createdAt"))`;
  const paying = Prisma.sql`u."membershipExpiresAt" > now()`;
  const [statusRow] = await prisma.$queryRaw<
    {
      total: number; activos: number; pagando: number; pagandoConPac: number; renuevanEn7d: number; enPrueba: number;
      pruebaVencenEn5d: number; pruebaVencidaNuncaPago: number; exPagadoras: number; intentoSinCerrar: number; pendientesTransferencia: number;
    }[]
  >`
    SELECT COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE u."isActive")::int AS activos,
      COUNT(*) FILTER (WHERE ${paying})::int AS pagando,
      COUNT(*) FILTER (WHERE ${paying} AND u."flowSubscriptionId" IS NOT NULL)::int AS "pagandoConPac",
      COUNT(*) FILTER (WHERE ${paying} AND u."flowSubscriptionId" IS NULL AND u."membershipExpiresAt" <= now() + interval '7 days')::int AS "renuevanEn7d",
      COUNT(*) FILTER (WHERE NOT COALESCE(${paying}, false) AND ${trialSql} > now())::int AS "enPrueba",
      COUNT(*) FILTER (WHERE NOT COALESCE(${paying}, false) AND ${trialSql} > now() AND ${trialSql} <= now() + interval '5 days' AND NOT ${everPaid})::int AS "pruebaVencenEn5d",
      COUNT(*) FILTER (WHERE NOT COALESCE(${paying}, false) AND ${trialSql} <= now() AND NOT ${everPaid})::int AS "pruebaVencidaNuncaPago",
      COUNT(*) FILTER (WHERE NOT COALESCE(${paying}, false) AND ${everPaid})::int AS "exPagadoras",
      COUNT(*) FILTER (WHERE NOT COALESCE(${paying}, false) AND ${openAttempt})::int AS "intentoSinCerrar",
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = u."id" AND pi."status" = 'PENDING' AND pi."method" = 'TRANSFER' AND pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)})))::int AS "pendientesTransferencia"
    FROM "User" u WHERE ${organic}`;

  // ── 3. Checkout: pagos de membresía abiertos en el periodo ──
  const intents = await prisma.paymentIntent.findMany({
    where: {
      purpose: { in: [...PLAN_PURPOSES] },
      createdAt: { gte: from },
      subscriber: { AND: [organicSignupWhere(), { profileType: { in: types } }] },
    },
    select: { subscriberId: true, status: true, method: true, amount: true, createdAt: true },
  });
  const checkoutByMethod = new Map<string, { abiertos: number; pagados: number; fallidos: number; abandonados: number; pendientes: number; clp: number }>();
  const startedUsers = new Set<string>();
  const paidUsers = new Set<string>();
  for (const i of intents) {
    const row = checkoutByMethod.get(i.method) ?? { abiertos: 0, pagados: 0, fallidos: 0, abandonados: 0, pendientes: 0, clp: 0 };
    row.abiertos += 1;
    startedUsers.add(i.subscriberId);
    if (i.status === "PAID") {
      row.pagados += 1;
      row.clp += i.amount;
      paidUsers.add(i.subscriberId);
    } else if (i.status === "FAILED") row.fallidos += 1;
    else if (i.status === "EXPIRED" || (i.status === "PENDING" && i.method === "FLOW" && now.getTime() - i.createdAt.getTime() > ABANDON_MS)) row.abandonados += 1;
    else row.pendientes += 1;
    checkoutByMethod.set(i.method, row);
  }

  // ── 4. Cohortes mensuales (últimos 12 meses) ──
  const cohorts = await prisma.$queryRaw<
    { mes: string; registros: number; publicadas: number; verificadas: number; pagaron30d: number; pagaronAlguna: number; pagandoHoy: number; activas30d: number }[]
  >`
    SELECT to_char((u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${CHILE_TZ}, 'YYYY-MM') AS mes,
      COUNT(*)::int AS registros,
      COUNT(*) FILTER (WHERE u."profileCompletedAt" IS NOT NULL)::int AS publicadas,
      COUNT(*) FILTER (WHERE u."isVerified")::int AS verificadas,
      COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = u."id" AND pi."status" = 'PAID'
        AND pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)}) AND COALESCE(pi."paidAt", pi."createdAt") <= u."createdAt" + interval '30 days'))::int AS "pagaron30d",
      COUNT(*) FILTER (WHERE ${everPaid})::int AS "pagaronAlguna",
      COUNT(*) FILTER (WHERE ${paying})::int AS "pagandoHoy",
      COUNT(*) FILTER (WHERE u."lastSeen" >= ${since30})::int AS "activas30d"
    FROM "User" u
    WHERE ${organic} AND u."createdAt" >= ${new Date(now.getTime() - 365 * DAY_MS)}
    GROUP BY 1 ORDER BY 1`;

  // ── 5. Valor que reciben y precio ──
  // Perfiles publicados hoy: cuántos contactos les llegan al mes, pagando o no.
  const published = await prisma.user.findMany({
    where: { AND: [organicSignupWhere(), { profileType: { in: types }, isActive: true, profileCompletedAt: { not: null } }] },
    select: { id: true, baseRate: true, membershipExpiresAt: true, profileType: true },
    take: 20000,
  });
  const publishedActivity = await activityByProfile(published.map((p) => p.id), since30);
  const groups = { pagando: [] as number[], sinPagar: [] as number[] };
  const buckets = [
    { label: "0", min: 0, max: 0, count: 0 },
    { label: "1–4", min: 1, max: 4, count: 0 },
    { label: "5–19", min: 5, max: 19, count: 0 },
    { label: "20–49", min: 20, max: 49, count: 0 },
    { label: "50+", min: 50, max: Infinity, count: 0 },
  ];
  for (const p of published) {
    const a = publishedActivity.get(p.id);
    const n = a ? a.contacts + a.conversations : 0;
    (p.membershipExpiresAt && p.membershipExpiresAt > now ? groups.pagando : groups.sinPagar).push(n);
    const b = buckets.find((x) => n >= x.min && n <= x.max);
    if (b) b.count += 1;
  }
  const allContacts = [...groups.pagando, ...groups.sinPagar];
  const rates = published.filter((p) => p.profileType === "PROFESSIONAL" && p.baseRate && p.baseRate >= 5000).map((p) => p.baseRate as number);
  const medianRate = median(rates);
  const avgContacts = avg(allContacts);

  // Precios que ya se cobraron: si la tarifa cambió, cada precio es un experimento real.
  const pricePoints = await prisma.$queryRaw<{ monto: number; intentos: number; pagados: number; pagadoras: number; desde: Date; hasta: Date }[]>`
    SELECT pi."amount" AS monto, COUNT(*)::int AS intentos, COUNT(*) FILTER (WHERE pi."status" = 'PAID')::int AS pagados,
      COUNT(DISTINCT pi."subscriberId") FILTER (WHERE pi."status" = 'PAID')::int AS pagadoras,
      MIN(pi."createdAt") AS desde, MAX(pi."createdAt") AS hasta
    FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId"
    WHERE pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)}) AND ${organic}
    GROUP BY 1 ORDER BY 1`;

  const [revenue30, churnRow] = await Promise.all([
    prisma.$queryRaw<{ clp: number; pagos: number; pagadoras: number }[]>`
      SELECT COALESCE(SUM(pi."amount"), 0)::int AS clp, COUNT(*)::int AS pagos, COUNT(DISTINCT pi."subscriberId")::int AS pagadoras
      FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId"
      WHERE pi."status" = 'PAID' AND pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)}) AND pi."paidAt" >= ${since30} AND ${organic}`,
    // Membresías que vencieron hace 14 a 44 días: ¿volvieron a pagar alrededor del vencimiento?
    prisma.$queryRaw<{ vencidas: number; perdidas: number }[]>`
      SELECT COUNT(*)::int AS vencidas,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = u."id" AND pi."status" = 'PAID'
          AND pi."purpose"::text IN (${Prisma.join(PLAN_PURPOSES)}) AND pi."paidAt" >= u."membershipExpiresAt" - interval '7 days'))::int AS perdidas
      FROM "User" u
      WHERE ${organic} AND u."membershipExpiresAt" >= now() - interval '44 days' AND u."membershipExpiresAt" < now() - interval '14 days'`,
  ]);
  const churnPct = pct(churnRow[0]?.perdidas ?? 0, churnRow[0]?.vencidas ?? 0);
  const monthlyChurn = churnPct !== null && churnPct > 0 ? churnPct / 100 : null;

  // Pozo mensual para el simulador: perfiles que terminan la prueba por mes.
  const publishedInCohort = sequential.publicada;
  const monthlyPool = Math.round((publishedInCohort / opts.days) * 30);

  return {
    generatedAt: now.toISOString(),
    filters: { days: opts.days, profileType: opts.profileType, from: from.toISOString() },
    billing: {
      enabled: billing.enabled,
      enforced: isBillingEnforced(billing, now),
      graceEndsAt: graceEndsAt(billing)?.toISOString() ?? null,
      trialDays: billing.trialDays,
      priceClp: price,
    },
    funnel: {
      total,
      stages,
      trialEnded,
      trialEndedPaid,
      trialConversionPct: pct(trialEndedPaid, trialEnded),
      medianDaysToFirstPayment: median(daysToPay),
      bySource: [...bySource.entries()]
        .map(([source, r]) => ({ source, ...r, pctPublicadas: pct(r.publicadas, r.registros), pctPagaron: pct(r.pagaron, r.registros) }))
        .sort((x, y) => y.registros - x.registros),
    },
    paymentStatus: statusRow,
    checkout: {
      byMethod: [...checkoutByMethod.entries()].map(([method, r]) => ({ method, ...r, pctPagados: pct(r.pagados, r.abiertos) })),
      startedUsers: startedUsers.size,
      paidUsers: paidUsers.size,
      conversionPct: pct(paidUsers.size, startedUsers.size),
    },
    cohorts: cohorts.map((c) => ({
      ...c,
      pctPublicadas: pct(c.publicadas, c.registros),
      pctPagaron30d: pct(c.pagaron30d, c.registros),
      pctPagandoHoy: pct(c.pagandoHoy, c.registros),
    })),
    value: {
      publishedProfiles: published.length,
      avgContacts30d: avgContacts,
      medianContacts30d: median(allContacts),
      paying: { profiles: groups.pagando.length, avgContacts30d: avg(groups.pagando), medianContacts30d: median(groups.pagando) },
      notPaying: { profiles: groups.sinPagar.length, avgContacts30d: avg(groups.sinPagar), medianContacts30d: median(groups.sinPagar) },
      contactBuckets: buckets.map(({ label, count }) => ({ label, count, pct: pct(count, published.length) })),
      pctWithContacts: pct(allContacts.filter((n) => n > 0).length, allContacts.length),
      costPerContactClp: avgContacts ? Math.round(price / avgContacts) : null,
      medianServiceRateClp: medianRate,
      feeAsPctOfServiceRate: medianRate ? pct(price, medianRate) : null,
      rateSample: rates.length,
    },
    pricing: {
      priceClp: price,
      activeMembers: statusRow.pagando,
      mrrClp: statusRow.pagando * price,
      revenue30dClp: revenue30[0]?.clp ?? 0,
      payers30d: revenue30[0]?.pagadoras ?? 0,
      arpuClp: revenue30[0]?.pagadoras ? Math.round(revenue30[0].clp / revenue30[0].pagadoras) : null,
      churn: { expired: churnRow[0]?.vencidas ?? 0, lost: churnRow[0]?.perdidas ?? 0, pct: churnPct },
      ltvClp: monthlyChurn ? Math.round(price / monthlyChurn) : null,
      pricePoints: pricePoints.map((r) => ({ ...r, pctPagados: pct(r.pagados, r.intentos), desde: r.desde.toISOString(), hasta: r.hasta.toISOString() })),
      monthlyPool,
      unpaidPublishedNow: groups.sinPagar.length,
    },
    criteria: [
      "Sólo registros orgánicos: sin perfiles cargados por el equipo, de prueba ni cuentas del equipo.",
      "El embudo es secuencial: cada etapa cuenta a quienes cumplen esa etapa y todas las anteriores. “Independiente” cuenta a quienes la cumplen aunque se hayan saltado una anterior.",
      "Contactos = clicks de WhatsApp o teléfono (uno por persona, perfil y día, sin el equipo) + conversaciones de chat (remitentes distintos).",
      "Pago abandonado = pago por Flow que quedó pendiente más de 1 hora, o que Flow marcó como vencido.",
      "Churn = membresías que vencieron hace 14 a 44 días sin un pago desde 7 días antes del vencimiento. LTV = precio ÷ churn mensual.",
      `La prueba dura ${billing.trialDays} días desde el registro (o hasta la fecha de prueba del perfil si es posterior).`,
    ],
  };
}

// ── Listas para marketing ─────────────────────────────────────────────────

export const LEAD_SEGMENTS = {
  sin_publicar: { label: "Se registró y no publicó", goal: "Que termine de crear su ficha." },
  sin_fotos: { label: "Publicada sin fotos suficientes", goal: "Que suba fotos: sin fotos no recibe contactos." },
  ficha_incompleta: { label: "Ficha incompleta", goal: "Que complete los datos que le faltan." },
  sin_verificar: { label: "Sin verificar", goal: "Que se verifique para ganar confianza y visibilidad." },
  prueba_por_vencer: { label: "Prueba por vencer (≤ 5 días)", goal: "Convertir antes de que se oculte." },
  prueba_vencida: { label: "Prueba vencida, nunca pagó", goal: "Recuperar con una oferta." },
  pago_abandonado: { label: "Intentó pagar y no terminó", goal: "Ayudar a cerrar el pago (problema con Flow, transferencia)." },
  ex_pagadoras: { label: "Pagó antes y dejó de pagar", goal: "Recuperar clientas que ya confiaron." },
  renovacion_proxima: { label: "Renueva en ≤ 7 días sin PAC", goal: "Asegurar la renovación." },
} as const;
export type LeadSegment = keyof typeof LEAD_SEGMENTS;

export async function buildFunnelLeads(segment: LeadSegment, opts: FunnelOptions & { limit: number }) {
  const now = new Date();
  const types = typesOf(opts);
  const billing = await getBillingSettings();
  const trialMs = billing.trialDays * DAY_MS;
  const since180 = new Date(now.getTime() - 180 * DAY_MS);
  const notPaying = { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] };

  const segmentWhere: Record<LeadSegment, Prisma.UserWhereInput> = {
    sin_publicar: { profileCompletedAt: null, createdAt: { gte: since180 } },
    sin_fotos: { profileCompletedAt: { not: null }, isActive: true },
    ficha_incompleta: { profileCompletedAt: { not: null }, isActive: true },
    sin_verificar: { profileCompletedAt: { not: null }, isActive: true, isVerified: false },
    prueba_por_vencer: { ...notPaying, createdAt: { gte: new Date(now.getTime() - trialMs - 30 * DAY_MS) } },
    prueba_vencida: { ...notPaying, createdAt: { lte: new Date(now.getTime() - trialMs) } },
    pago_abandonado: { ...notPaying, paymentIntents: { some: { purpose: { in: [...PLAN_PURPOSES] }, status: { not: "PAID" }, createdAt: { gte: since180 } } } },
    ex_pagadoras: { ...notPaying, paymentIntents: { some: { purpose: { in: [...PLAN_PURPOSES] }, status: "PAID" } } },
    renovacion_proxima: { membershipExpiresAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY_MS) }, flowSubscriptionId: null },
  };

  const candidates = await prisma.user.findMany({
    where: { AND: [organicSignupWhere(), { profileType: { in: types } }, segmentWhere[segment]] },
    orderBy: { createdAt: "desc" },
    select: profileSelect,
    take: 3000,
  });
  const ids = candidates.map((p) => p.id);
  const [activity, intents] = await Promise.all([activityByProfile(ids, new Date(now.getTime() - 30 * DAY_MS)), intentsByProfile(ids)]);

  const rows = candidates
    .map((p) => {
      const missing = missingFor(p);
      const ints = intents.get(p.id);
      const act = activity.get(p.id) ?? { contacts: 0, conversations: 0 };
      const trialEndsAt = trialEndOf(p, billing.trialDays);
      return { p, missing, ints, act, trialEndsAt };
    })
    .filter(({ p, missing, ints, trialEndsAt }) => {
      const paid = (ints?.paid ?? 0) > 0;
      switch (segment) {
        case "sin_fotos":
          return !hasPhotos(p);
        case "ficha_incompleta":
          return hasPhotos(p) && missing.length > 0;
        case "sin_verificar":
          return !p.verificationRejectedAt;
        case "prueba_por_vencer":
          return !paid && trialEndsAt > now && trialEndsAt.getTime() <= now.getTime() + 5 * DAY_MS;
        case "prueba_vencida":
          return !paid && trialEndsAt <= now;
        case "pago_abandonado":
          return Boolean(ints?.openAttempt);
        default:
          return true;
      }
    })
    .sort((x, y) => {
      const ix = x.act.contacts + x.act.conversations;
      const iy = y.act.contacts + y.act.conversations;
      if (iy !== ix) return iy - ix;
      return (y.p.lastSeen?.getTime() ?? 0) - (x.p.lastSeen?.getTime() ?? 0);
    });

  return {
    generatedAt: now.toISOString(),
    segment,
    ...LEAD_SEGMENTS[segment],
    total: rows.length,
    priceClp: billing.priceClp,
    items: rows.slice(0, opts.limit).map(({ p, missing, ints, act, trialEndsAt }) => ({
      id: p.id,
      username: p.username,
      displayName: p.displayName,
      email: p.email,
      phone: p.phone,
      city: p.city,
      avatarUrl: p.avatarUrl,
      profileType: p.profileType,
      signupSource: p.signupSource,
      createdAt: p.createdAt.toISOString(),
      lastSeen: p.lastSeen?.toISOString() ?? null,
      isActive: p.isActive,
      isVerified: p.isVerified,
      photos: photoCount(p),
      missing,
      contacts30d: act.contacts,
      conversations30d: act.conversations,
      trialEndsAt: trialEndsAt.toISOString(),
      membershipExpiresAt: p.membershipExpiresAt?.toISOString() ?? null,
      hasPac: Boolean(p.flowSubscriptionId),
      payments: ints?.paid ?? 0,
      lastPaidAt: ints?.lastPaidAt?.toISOString() ?? null,
      openAttempt: ints?.openAttempt
        ? { ...ints.openAttempt, createdAt: ints.openAttempt.createdAt.toISOString() }
        : null,
    })),
  };
}

adminFunnelRouter.get(
  "/funnel",
  asyncHandler(async (req, res) => {
    res.json(await buildSalesFunnel(parseFunnelOptions(req.query as Record<string, unknown>)));
  }),
);

adminFunnelRouter.get(
  "/funnel/leads",
  asyncHandler(async (req, res) => {
    const segment = String(req.query.segment || "");
    if (!(segment in LEAD_SEGMENTS)) return res.status(400).json({ error: "INVALID_SEGMENT", segments: Object.keys(LEAD_SEGMENTS) });
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    res.json(await buildFunnelLeads(segment as LeadSegment, { ...parseFunnelOptions(req.query as Record<string, unknown>), limit }));
  }),
);
