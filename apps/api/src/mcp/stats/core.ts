import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { foldText, matchRegion, normalizeCity, type GeoNormalized } from "../../lib/chileGeo";
import { BOT_UA_PATTERN, realUserSql, staffIdsSql } from "../../lib/statsFilters";
import { PROFILE_TYPES, TIERS, TZ, chileMidnight, chileToday, deltaPct, type Period } from "../helpers";

/**
 * Núcleo del panel de estadísticas: filtros comunes, atribución de sesiones
 * (fuente, dispositivo, PWA, nuevo/recurrente) y un set de métricas base que
 * usan las comparaciones, las alertas y el informe semanal.
 *
 * Todo el SQL de acá se compone con Prisma.sql (parámetros ligados); los
 * únicos `Prisma.raw` son nombres fijos que nunca vienen del input.
 */

export type Range = { from: Date; to: Date };

// ── Filtros ────────────────────────────────────────────────────────────────

export const FUENTES = ["organico", "directo", "redes", "referidos", "ads", "campana"] as const;
export const ESTADOS_PERFIL = ["publicado", "oculto", "pendiente", "rechazado"] as const;

export const filtrosShape = {
  region: z.string().optional().describe("Región de Chile (ej. Metropolitana, Valparaíso, Biobío)."),
  ciudad: z.string().optional().describe("Ciudad normalizada (las comunas del Gran Santiago cuentan como Santiago)."),
  comuna: z.string().optional().describe("Comuna exacta (ej. Providencia, Viña del Mar)."),
  categoria: z.string().optional().describe("escort, masajes, moteles, sexshop, trans, despedidas, videollamadas."),
  tipoPerfil: z.enum(PROFILE_TYPES).optional(),
  tier: z.enum([...TIERS, "NINGUNO"]).optional(),
  verificado: z.boolean().optional(),
  estadoPerfil: z.enum(ESTADOS_PERFIL).optional().describe("publicado = activo y verificado; pendiente = sin verificar; oculto = desactivado; rechazado = desactivado sin verificar."),
  dispositivo: z.enum(["movil", "desktop", "tablet"]).optional(),
  modo: z.enum(["pwa", "web"]).optional().describe("pwa = app instalada; web = navegador."),
  fuente: z.enum(FUENTES).optional().describe("Fuente de la sesión: organico (buscadores), directo, redes, referidos, ads (utm_medium pagado), campana (utm_campaign)."),
  tipoUsuario: z.enum(["nuevo", "recurrente"]).optional().describe("Visitante nuevo (primera vez en el periodo) o recurrente."),
  sesion: z.enum(["registrado", "anonimo"]).optional(),
  segmento: z.string().optional().describe("Nombre de un segmento guardado; sus filtros se aplican y los explícitos los sobreescriben."),
};

export type Filtros = {
  region?: string;
  ciudad?: string;
  comuna?: string;
  categoria?: string;
  tipoPerfil?: (typeof PROFILE_TYPES)[number];
  tier?: (typeof TIERS)[number] | "NINGUNO";
  verificado?: boolean;
  estadoPerfil?: (typeof ESTADOS_PERFIL)[number];
  dispositivo?: "movil" | "desktop" | "tablet";
  modo?: "pwa" | "web";
  fuente?: (typeof FUENTES)[number];
  tipoUsuario?: "nuevo" | "recurrente";
  sesion?: "registrado" | "anonimo";
  segmento?: string;
};

const FILTER_KEYS = Object.keys(filtrosShape) as (keyof Filtros)[];

export function pickFiltros(args: Record<string, unknown>): Filtros {
  const out: Record<string, unknown> = {};
  for (const k of FILTER_KEYS) if (args[k] !== undefined) out[k] = args[k];
  return out as Filtros;
}

/** Mezcla un segmento guardado (si lo hay) con los filtros explícitos. */
export async function withSegment(f: Filtros): Promise<Filtros> {
  if (!f.segmento) return f;
  const seg = await prisma.statsSegment.findFirst({ where: { name: { equals: f.segmento, mode: "insensitive" } } });
  if (!seg) throw new Error(`No existe el segmento "${f.segmento}".`);
  const { segmento: _s, ...explicit } = f;
  return { ...(seg.filters as Filtros), ...explicit };
}

export function describeFiltros(f: Filtros): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of FILTER_KEYS) if (f[k] !== undefined) out[k] = f[k];
  return Object.keys(out).length ? out : { ninguno: true, nota: "Siempre sin bots, sin el equipo, sin /admin y sin perfiles de prueba." };
}

// ── Geografía: qué valores crudos de `city` caen en cada región/ciudad/comuna ──

type CityIndex = { raw: string; geo: GeoNormalized }[];
let cityIndexCache: { at: number; users: CityIndex; visitors: CityIndex } | null = null;

async function cityIndex(): Promise<{ users: CityIndex; visitors: CityIndex }> {
  if (cityIndexCache && Date.now() - cityIndexCache.at < 10 * 60 * 1000) return cityIndexCache;
  const [u, v] = await Promise.all([
    prisma.$queryRaw<{ city: string }[]>`SELECT DISTINCT "city" FROM "User" WHERE "city" IS NOT NULL LIMIT 5000`,
    prisma.$queryRaw<{ city: string }[]>`
      SELECT "city" FROM "PageView" WHERE "city" IS NOT NULL AND "createdAt" > now() - interval '90 days'
      GROUP BY 1 ORDER BY count(*) DESC LIMIT 3000`,
  ]);
  cityIndexCache = {
    at: Date.now(),
    users: u.map((r) => ({ raw: r.city, geo: normalizeCity(r.city) })),
    visitors: v.map((r) => ({ raw: r.city, geo: normalizeCity(r.city) })),
  };
  return cityIndexCache;
}

function geoMatches(geo: GeoNormalized, f: Filtros): boolean {
  if (f.region) {
    const wanted = matchRegion(f.region) ?? f.region;
    if (foldText(geo.region) !== foldText(wanted)) return false;
  }
  if (f.ciudad && foldText(geo.ciudad) !== foldText(f.ciudad)) return false;
  if (f.comuna && foldText(geo.comuna) !== foldText(f.comuna)) return false;
  return true;
}

/** Valores crudos de city que calzan con los filtros geográficos (null = sin filtro geográfico). */
export async function rawCitiesFor(f: Filtros, kind: "users" | "visitors"): Promise<string[] | null> {
  if (!f.region && !f.ciudad && !f.comuna) return null;
  const idx = await cityIndex();
  return idx[kind].filter((e) => geoMatches(e.geo, f)).map((e) => e.raw);
}

// ── Categorías: alias de lo que la gente escribe en primaryCategory/serviceCategory ──

const CATEGORY_ALIASES: Record<string, string[]> = {
  escort: ["escort", "escorts", "acompanamiento", "acompañamiento", "acompanante"],
  masajes: ["masajes", "masaje", "masajes sensuales", "masajista", "masajistas"],
  moteles: ["motel", "moteles", "hotel", "hoteles", "hospedaje"],
  motel: ["motel", "moteles", "hotel", "hoteles", "hospedaje"],
  sexshop: ["sexshop", "sex shop", "sex-shop", "lenceria", "lencería", "juguetes"],
  trans: ["trans", "transexual", "travesti"],
  despedidas: ["despedidas", "despedida", "despedida de soltero", "shows"],
  videollamadas: ["videollamadas", "videollamada", "video llamada", "cam"],
};

function categoryAliases(cat: string): string[] {
  const key = foldText(cat);
  const list = CATEGORY_ALIASES[key] ?? [cat];
  return [...new Set(list.map((a) => a.toLowerCase()))];
}

// ── SQL de filtros de perfil (alias de "User") ─────────────────────────────

export async function profileSql(f: Filtros, alias = "u"): Promise<Prisma.Sql> {
  const a = Prisma.raw(`"${alias}"`);
  const parts: Prisma.Sql[] = [realUserSql(alias)];
  const cities = await rawCitiesFor(f, "users");
  if (cities) parts.push(cities.length ? Prisma.sql`${a}."city" = ANY(${cities}::text[])` : Prisma.sql`FALSE`);
  if (f.categoria) {
    const aliases = categoryAliases(f.categoria);
    parts.push(Prisma.sql`(
      lower(${a}."primaryCategory") = ANY(${aliases}::text[]) OR lower(${a}."serviceCategory") = ANY(${aliases}::text[])
      OR ${a}."categoryId" IN (SELECT "id" FROM "Category" WHERE lower("slug") = ANY(${aliases}::text[]))
    )`);
  }
  if (f.tipoPerfil) parts.push(Prisma.sql`${a}."profileType"::text = ${f.tipoPerfil}`);
  if (f.tier) parts.push(f.tier === "NINGUNO" ? Prisma.sql`${a}."tier" IS NULL` : Prisma.sql`${a}."tier"::text = ${f.tier}`);
  if (f.verificado !== undefined) parts.push(Prisma.sql`${a}."isVerified" = ${f.verificado}`);
  switch (f.estadoPerfil) {
    case "publicado": parts.push(Prisma.sql`${a}."isActive" AND ${a}."isVerified"`); break;
    case "pendiente": parts.push(Prisma.sql`${a}."isActive" AND NOT ${a}."isVerified"`); break;
    case "oculto": parts.push(Prisma.sql`NOT ${a}."isActive" AND ${a}."isVerified"`); break;
    case "rechazado": parts.push(Prisma.sql`NOT ${a}."isActive" AND NOT ${a}."isVerified"`); break;
  }
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

export function hasProfileFilters(f: Filtros): boolean {
  return Boolean(f.region || f.ciudad || f.comuna || f.categoria || f.tipoPerfil || f.tier || f.verificado !== undefined || f.estadoPerfil);
}

export function hasTrafficFilters(f: Filtros): boolean {
  return Boolean(f.dispositivo || f.modo || f.fuente || f.tipoUsuario || f.sesion || f.region || f.ciudad || f.comuna);
}

// ── Atribución de sesiones ────────────────────────────────────────────────

const SEARCH_ENGINES = "google\\.|bing\\.|yahoo\\.|duckduckgo\\.|ecosia\\.|yandex\\.|baidu\\.";
const SOCIAL = "instagram\\.|facebook\\.|fb\\.|tiktok\\.|twitter\\.|x\\.com|t\\.co/|telegram|t\\.me|whatsapp|reddit\\.|youtube\\.|youtu\\.be|threads\\.|snapchat\\.|pinterest\\.|linkedin\\.|discord";

/** Fuente de una vista (se aplica a la primera de la sesión). */
export function sourceSql(alias = "pv"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`CASE
    WHEN lower(COALESCE(${a}."utmMedium", '')) ~ '^(cpc|ppc|paid|ads|display|paid_social|paidsocial)$' OR lower(COALESCE(${a}."utmSource", '')) ~ 'ads$' THEN 'ads'
    WHEN ${a}."utmCampaign" IS NOT NULL OR ${a}."utmSource" IS NOT NULL THEN 'campana'
    WHEN ${a}."referrer" IS NULL OR ${a}."referrer" = '' THEN 'directo'
    WHEN ${a}."referrer" ~* '^https?://([a-z0-9-]+[.])*uzeed[.]cl' THEN 'directo'
    WHEN ${a}."referrer" ~* ${SEARCH_ENGINES} THEN 'organico'
    WHEN ${a}."referrer" ~* ${SOCIAL} THEN 'redes'
    ELSE 'referidos'
  END`;
}

export const skeySql = (alias = "pv") => Prisma.sql`COALESCE(${Prisma.raw(`"${alias}"`)}."sessionId", ${Prisma.raw(`"${alias}"`)}."id"::text)`;
export const vkeySql = (alias = "pv") =>
  Prisma.sql`COALESCE(${Prisma.raw(`"${alias}"`)}."visitorId", ${Prisma.raw(`"${alias}"`)}."sessionId", ${Prisma.raw(`"${alias}"`)}."userId"::text, ${Prisma.raw(`"${alias}"`)}."id"::text)`;

function realPv(alias = "pv"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`(${a}."path" NOT LIKE '/admin%'
    AND (${a}."userAgent" IS NULL OR ${a}."userAgent" !~* ${BOT_UA_PATTERN})
    AND (${a}."userId" IS NULL OR ${a}."userId" NOT IN ${staffIdsSql()}))`;
}

/**
 * CTEs de tráfico. Deja definidas:
 *  - fs:  sesiones del rango que pasan los filtros (una fila por sesión, con
 *         fuente, dispositivo, modo, nuevo/recurrente, landing, salida, páginas, duración).
 *  - pvf: vistas reales del rango de esas sesiones.
 *  - uaf: acciones reales del rango de esas sesiones (o todas las reales si no hay filtros de tráfico).
 */
export async function trafficCtes(range: Range, f: Filtros): Promise<Prisma.Sql> {
  const conds: Prisma.Sql[] = [];
  if (f.dispositivo) conds.push(Prisma.sql`s.device = ${f.dispositivo === "movil" ? "mobile" : f.dispositivo}`);
  if (f.modo) conds.push(Prisma.sql`COALESCE(s."displayMode", 'browser') = ${f.modo === "pwa" ? "pwa" : "browser"}`);
  if (f.fuente) conds.push(Prisma.sql`s.fuente = ${f.fuente}`);
  if (f.tipoUsuario) conds.push(f.tipoUsuario === "nuevo" ? Prisma.sql`s.nuevo` : Prisma.sql`NOT s.nuevo`);
  if (f.sesion) conds.push(f.sesion === "registrado" ? Prisma.sql`s."userId" IS NOT NULL` : Prisma.sql`s."userId" IS NULL`);
  const cities = await rawCitiesFor(f, "visitors");
  if (cities) conds.push(cities.length ? Prisma.sql`s.vcity = ANY(${cities}::text[])` : Prisma.sql`FALSE`);
  const where = conds.length ? Prisma.sql`WHERE ${Prisma.join(conds, " AND ")}` : Prisma.empty;
  const filtered = conds.length > 0;

  return Prisma.sql`WITH s0 AS (
      SELECT DISTINCT ON (${skeySql("pv")}) ${skeySql("pv")} AS skey, ${vkeySql("pv")} AS vkey,
        pv."userId", pv."createdAt" AS started, pv."path" AS landing, pv."visitorId",
        ${sourceSql("pv")} AS fuente, pv."device", pv."displayMode", pv."city" AS vcity,
        pv."utmSource", pv."utmMedium", pv."utmCampaign", pv."referrer", pv."userAgent"
      FROM "PageView" pv
      WHERE pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to} AND ${realPv("pv")}
      ORDER BY ${skeySql("pv")}, pv."createdAt"
    ), sx AS (
      SELECT ${skeySql("pv")} AS skey, MAX(pv."createdAt") AS ended, COUNT(*)::int AS pages,
        (array_agg(pv."path" ORDER BY pv."createdAt" DESC))[1] AS exit_path,
        COUNT(*) FILTER (WHERE pv."path" LIKE '/profesional/%')::int AS profile_pages,
        COUNT(DISTINCT pv."path") FILTER (WHERE pv."path" LIKE '/profesional/%')::int AS profiles_seen
      FROM "PageView" pv
      WHERE pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to} AND ${realPv("pv")}
      GROUP BY 1
    ), s AS (
      SELECT s0.*, sx.ended, sx.pages, sx.exit_path, sx.profile_pages, sx.profiles_seen,
        EXTRACT(EPOCH FROM (sx.ended - s0.started))::float8 AS seconds,
        (s0."visitorId" IS NULL OR NOT EXISTS (
          SELECT 1 FROM "PageView" p2 WHERE p2."visitorId" = s0."visitorId" AND p2."createdAt" < ${range.from}
        )) AS nuevo
      FROM s0 JOIN sx USING (skey)
    ), fs AS (
      SELECT * FROM s ${where}
    ), pvf AS (
      SELECT pv.*, fs.fuente, fs.nuevo, fs.skey, fs.vkey
      FROM "PageView" pv JOIN fs ON ${skeySql("pv")} = fs.skey
      WHERE pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to} AND ${realPv("pv")}
    ), uaf AS (
      SELECT ua.*, COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) AS akey
        ${filtered ? Prisma.sql`, fs.fuente, fs.nuevo` : Prisma.sql`, NULL::text AS fuente, NULL::boolean AS nuevo`}
      FROM "UserAction" ua
      ${filtered ? Prisma.sql`JOIN fs ON COALESCE(ua."sessionId", ua."id"::text) = fs.skey` : Prisma.empty}
      WHERE ua."createdAt" >= ${range.from} AND ua."createdAt" < ${range.to}
        AND (ua."userId" IS NULL OR ua."userId" NOT IN ${staffIdsSql()})
    )`;
}

/** Join de una vista de ficha con su perfil (para filtrar por perfil). */
export function profilePathJoin(pvAlias = "pvf", uAlias = "u"): Prisma.Sql {
  const p = Prisma.raw(`"${pvAlias}"`);
  const u = Prisma.raw(`"${uAlias}"`);
  return Prisma.sql`JOIN "User" ${u} ON ${p}."path" LIKE '/profesional/%'
    AND (split_part(${p}."path", '/', 3) = ${u}."id"::text OR split_part(${p}."path", '/', 3) = ${u}."username")`;
}

/** Clave de contacto único: persona + perfil + día (hora de Chile). */
export function contactKeySql(alias = "uaf"): Prisma.Sql {
  const a = Prisma.raw(`"${alias}"`);
  return Prisma.sql`(${a}.akey || ':' || COALESCE(${a}."targetId"::text, '') || ':' || to_char((${a}."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD'))`;
}

// ── Periodos: hora como agrupación y "mismo periodo del año anterior" ─────

export const BUCKETS = { hora: "hour", dia: "day", semana: "week", mes: "month" } as const;
export type Bucket = keyof typeof BUCKETS;

export function bucketFormat(bucket: Bucket): string {
  return bucket === "hora" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";
}

/** Mismo rango un año antes (mismas fechas de calendario en Chile). */
export function yearAgo(period: Period): Range {
  const shift = (d: Date) => {
    const ymd = chileToday(d);
    const [y, m, day] = ymd.split("-").map(Number);
    const target = `${y - 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return chileMidnight(target.endsWith("02-29") ? `${y - 1}-02-28` : target);
  };
  const from = shift(period.from);
  const to = new Date(from.getTime() + (period.to.getTime() - period.from.getTime()));
  return { from, to };
}

// ── Set de métricas base (comparaciones, alertas, informe semanal) ─────────

export type MetricSet = Record<string, number>;

export async function metricSet(range: Range, f: Filtros): Promise<MetricSet> {
  const ctes = await trafficCtes(range, f);
  const pf = await profileSql(f, "u");
  const profileFiltered = hasProfileFilters(f);
  const pvJoin = profileFiltered ? profilePathJoin("pvf", "u") : Prisma.empty;
  const pvWhere = profileFiltered ? Prisma.sql`WHERE ${pf}` : Prisma.empty;
  const uaJoin = profileFiltered ? Prisma.sql`JOIN "User" u ON u."id" = uaf."targetId" AND ${pf}` : Prisma.empty;
  const createdIn = (alias: string) => {
    const a = Prisma.raw(`"${alias}"`);
    return Prisma.sql`${a}."createdAt" >= ${range.from} AND ${a}."createdAt" < ${range.to}`;
  };

  const rows = await prisma.$queryRaw<Record<string, number>[]>`${ctes}
    SELECT
      (SELECT COUNT(*) FROM pvf ${profileFiltered ? Prisma.sql`${pvJoin} ${pvWhere}` : Prisma.empty})::int AS visitas,
      (SELECT COUNT(DISTINCT pvf.vkey) FROM pvf ${profileFiltered ? Prisma.sql`${pvJoin} ${pvWhere}` : Prisma.empty})::int AS visitantes,
      (SELECT COUNT(*) FROM fs)::int AS sesiones,
      (SELECT COUNT(*) FROM pvf ${profilePathJoin("pvf", "u")} WHERE ${pf})::int AS "vistasFichas",
      (SELECT COUNT(DISTINCT pvf.vkey) FROM pvf ${profilePathJoin("pvf", "u")} WHERE ${pf})::int AS "visitantesFichas",
      (SELECT COUNT(DISTINCT ${contactKeySql("uaf")}) FROM uaf ${uaJoin} WHERE uaf."action" = 'whatsapp_click')::int AS "contactosWhatsapp",
      (SELECT COUNT(DISTINCT ${contactKeySql("uaf")}) FROM uaf ${uaJoin} WHERE uaf."action" = 'phone_click')::int AS "contactosTelefono",
      (SELECT COUNT(*) FROM "Message" m JOIN "User" u ON u."id" = m."toId" AND ${pf}
        WHERE ${createdIn("m")} AND m."fromId" NOT IN ${staffIdsSql()})::int AS "mensajesRecibidos",
      (SELECT COUNT(*) FROM "Favorite" fv JOIN "User" u ON u."id" = fv."professionalId" AND ${pf} WHERE ${createdIn("fv")})::int AS favoritos,
      (SELECT COUNT(*) FROM "User" u WHERE ${createdIn("u")} AND ${pf} AND u."adminManaged" = false)::int AS "registrosOrganicos",
      (SELECT COALESCE(SUM(pi."amount"), 0) FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId" AND ${pf}
        WHERE pi."status" = 'PAID' AND pi."paidAt" >= ${range.from} AND pi."paidAt" < ${range.to})::int AS "ingresosClp",
      (SELECT COUNT(*) FROM "SearchLog" sl WHERE ${createdIn("sl")})::int AS busquedas,
      (SELECT COUNT(*) FROM "User" u WHERE ${pf} AND u."isActive" AND u."isVerified"
        AND u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP'))::int AS "perfilesPublicados"`;
  const r = rows[0] ?? {};
  const out: MetricSet = {};
  for (const [k, v] of Object.entries(r)) out[k] = Number(v) || 0;
  out.tasaContactoPct = out.visitantesFichas ? Math.round(((out.contactosWhatsapp + out.contactosTelefono) / out.visitantesFichas) * 1000) / 10 : 0;
  return out;
}

export function compareSets(a: MetricSet, b: MetricSet) {
  const out: Record<string, { actual: number; anterior: number; diferencia: number; variacionPct: number | null; baseChica?: true }> = {};
  for (const k of Object.keys(a)) {
    const cur = a[k] ?? 0;
    const prev = b[k] ?? 0;
    out[k] = {
      actual: cur,
      anterior: prev,
      diferencia: Math.round((cur - prev) * 100) / 100,
      variacionPct: deltaPct(cur, prev),
      ...(Math.max(cur, prev) < 20 && !k.endsWith("Pct") && !k.endsWith("Clp") ? { baseChica: true as const } : {}),
    };
  }
  return out;
}

export const METRIC_LABELS: Record<string, string> = {
  visitas: "Páginas vistas",
  visitantes: "Visitantes únicos",
  sesiones: "Sesiones",
  vistasFichas: "Vistas de fichas",
  visitantesFichas: "Visitantes de fichas",
  contactosWhatsapp: "Contactos WhatsApp",
  contactosTelefono: "Contactos teléfono",
  mensajesRecibidos: "Mensajes recibidos",
  favoritos: "Favoritos",
  registrosOrganicos: "Registros orgánicos",
  ingresosClp: "Ingresos CLP",
  busquedas: "Búsquedas",
  perfilesPublicados: "Perfiles publicados (foto actual)",
  tasaContactoPct: "Tasa de contacto %",
};
