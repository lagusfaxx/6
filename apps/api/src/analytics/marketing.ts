import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { getBillingSettings } from "../lib/billingSettings";
import { normalizeCity } from "../lib/chileGeo";
import { addDaysYmd, chileMidnight, chileToday } from "../lib/chileTime";
import { BOT_UA_PATTERN, profilePageSql, realUserSql, staffIdsSql } from "../lib/statsFilters";
import { deltaPct, resolvePeriod, type Period, type PeriodInput } from "../mcp/helpers";
import { localTs } from "../mcp/metrics";
import { contactKeySql, sourceSql, trafficCtes, type Range } from "../mcp/stats/core";

/**
 * Panel de marketing de /admin/estadisticas.
 *
 * Las cifras salen de la misma base que usa el MCP (`mcp/stats/core`), así que
 * el panel y los informes dicen lo mismo:
 *  - Tráfico sin bots, sin el equipo y sin /admin. Visitante = navegador
 *    (visitorId); sesión = pestaña (sessionId).
 *  - Contacto = click en WhatsApp o en llamar, una vez por persona, perfil y
 *    día (el doble click o el botón de arriba + el fijo de abajo no cuentan doble).
 *  - Lead = contacto + conversación nueva de un cliente con un perfil.
 *  - Registros orgánicos: sin perfiles de prueba, sin el equipo y sin las
 *    altas que carga el admin.
 *  - Cada número se compara con el periodo anterior del mismo largo (si el
 *    periodo está en curso, hasta la misma hora).
 */

export const MARKETING_PERIODS = ["hoy", "7d", "30d", "90d", "mes_actual", "mes_anterior"] as const;
export type MarketingPeriod = (typeof MARKETING_PERIODS)[number];

const CONTACT_ACTIONS = Prisma.sql`('whatsapp_click', 'phone_click')`;
const OFFER_TYPES = Prisma.sql`('PROFESSIONAL', 'ESTABLISHMENT', 'SHOP')`;
const CLIENT_TYPES = Prisma.sql`('CLIENT', 'VIEWER')`;
const UUID_RE = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

const n = (v: unknown) => Number(v) || 0;
const pct = (part: number, total: number, digits = 1) =>
  total ? Math.round((part / total) * 100 * 10 ** digits) / 10 ** digits : null;

// ── KPIs (se calculan igual para el periodo y para el anterior) ─────────────

type Kpis = {
  visitantes: number;
  visitantesNuevos: number;
  sesiones: number;
  rebotePct: number | null;
  paginasPorSesion: number;
  duracionMedianaSeg: number;
  vistas: number;
  vistasFichas: number;
  visitantesFichas: number;
  contactosWhatsapp: number;
  contactosTelefono: number;
  conversacionesNuevas: number;
  leads: number;
  visitantesQueContactaron: number;
  tasaContactoPct: number | null;
  conversionVisitaLeadPct: number | null;
  registrosClientes: number;
  registrosOferentes: number;
  ingresosClp: number;
  pagos: number;
  pagadores: number;
  busquedas: number;
  busquedasSinResultados: number;
};

async function kpis(range: Range): Promise<Kpis> {
  const ctes = await trafficCtes(range, {});
  const created = (alias: string) => {
    const a = Prisma.raw(`"${alias}"`);
    return Prisma.sql`${a}."createdAt" >= ${range.from} AND ${a}."createdAt" < ${range.to}`;
  };

  const [[t], [m], [u], [p], [s]] = await Promise.all([
    prisma.$queryRaw<Record<string, number>[]>`${ctes}
      SELECT
        (SELECT COUNT(DISTINCT vkey) FROM fs)::int AS visitantes,
        (SELECT COUNT(DISTINCT vkey) FROM fs WHERE nuevo)::int AS nuevos,
        (SELECT COUNT(*) FROM fs)::int AS sesiones,
        (SELECT COUNT(*) FROM fs WHERE pages = 1)::int AS rebotes,
        (SELECT COALESCE(AVG(pages), 0) FROM fs)::float8 AS pps,
        (SELECT COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds) FILTER (WHERE pages > 1), 0) FROM fs)::float8 AS duracion,
        (SELECT COUNT(*) FROM pvf)::int AS vistas,
        (SELECT COUNT(*) FROM pvf WHERE ${profilePageSql("pvf")})::int AS vistas_fichas,
        (SELECT COUNT(DISTINCT vkey) FROM pvf WHERE ${profilePageSql("pvf")})::int AS visitantes_fichas,
        (SELECT COUNT(DISTINCT ${contactKeySql("uaf")}) FROM uaf WHERE uaf."action" = 'whatsapp_click')::int AS wa,
        (SELECT COUNT(DISTINCT ${contactKeySql("uaf")}) FROM uaf WHERE uaf."action" = 'phone_click')::int AS tel,
        (SELECT COUNT(DISTINCT akey) FROM uaf WHERE uaf."action" IN ${CONTACT_ACTIONS})::int AS contactantes`,
    // Conversación nueva: un cliente escribe por primera vez a un perfil.
    prisma.$queryRaw<{ nuevas: number }[]>`
      WITH pairs AS (
        SELECT DISTINCT msg."fromId", msg."toId"
        FROM "Message" msg
        JOIN "User" c ON c."id" = msg."fromId" AND c."profileType"::text IN ${CLIENT_TYPES} AND ${realUserSql("c")}
        JOIN "User" o ON o."id" = msg."toId" AND o."profileType"::text IN ${OFFER_TYPES}
        WHERE ${created("msg")}
      )
      SELECT COUNT(*)::int AS nuevas FROM pairs p
      WHERE NOT EXISTS (
        SELECT 1 FROM "Message" o
        WHERE o."createdAt" < ${range.from}
          AND ((o."fromId" = p."fromId" AND o."toId" = p."toId") OR (o."fromId" = p."toId" AND o."toId" = p."fromId"))
      )`,
    prisma.$queryRaw<{ clientes: number; oferentes: number }[]>`
      SELECT
        COUNT(*) FILTER (WHERE u."profileType"::text IN ${CLIENT_TYPES})::int AS clientes,
        COUNT(*) FILTER (WHERE u."profileType"::text IN ${OFFER_TYPES})::int AS oferentes
      FROM "User" u
      WHERE ${created("u")} AND ${realUserSql("u")} AND u."adminManaged" = false`,
    // Ingresos: pagos confirmados + transferencias aprobadas (los depósitos por
    // Flow ya vienen como PaymentIntent, no se suman dos veces).
    prisma.$queryRaw<{ ingresos: number; pagos: number; pagadores: number }[]>`
      WITH pagos AS (
        SELECT pi."amount" AS monto, pi."subscriberId" AS uid FROM "PaymentIntent" pi
        WHERE pi."status" = 'PAID' AND pi."paidAt" >= ${range.from} AND pi."paidAt" < ${range.to}
        UNION ALL
        SELECT td."clpAmount", w."userId" FROM "TokenDeposit" td JOIN "Wallet" w ON w."id" = td."walletId"
        WHERE td."status" = 'APPROVED' AND td."method" = 'TRANSFER' AND td."reviewedAt" >= ${range.from} AND td."reviewedAt" < ${range.to}
      )
      SELECT COALESCE(SUM(monto), 0)::bigint AS ingresos, COUNT(*)::int AS pagos, COUNT(DISTINCT uid)::int AS pagadores FROM pagos`,
    prisma.$queryRaw<{ total: number; sin: number }[]>`
      SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE sl."resultCount" = 0)::int AS sin
      FROM "SearchLog" sl WHERE ${created("sl")}`,
  ]);

  const wa = n(t.wa);
  const tel = n(t.tel);
  const conv = n(m?.nuevas);
  const leads = wa + tel + conv;
  const visitantes = n(t.visitantes);
  const sesiones = n(t.sesiones);
  return {
    visitantes,
    visitantesNuevos: n(t.nuevos),
    sesiones,
    rebotePct: pct(n(t.rebotes), sesiones),
    paginasPorSesion: Math.round(n(t.pps) * 10) / 10,
    duracionMedianaSeg: Math.round(n(t.duracion)),
    vistas: n(t.vistas),
    vistasFichas: n(t.vistas_fichas),
    visitantesFichas: n(t.visitantes_fichas),
    contactosWhatsapp: wa,
    contactosTelefono: tel,
    conversacionesNuevas: conv,
    leads,
    visitantesQueContactaron: n(t.contactantes),
    tasaContactoPct: pct(n(t.contactantes), n(t.visitantes_fichas)),
    conversionVisitaLeadPct: pct(n(t.contactantes), visitantes),
    registrosClientes: n(u?.clientes),
    registrosOferentes: n(u?.oferentes),
    ingresosClp: n(p?.ingresos),
    pagos: n(p?.pagos),
    pagadores: n(p?.pagadores),
    busquedas: n(s?.total),
    busquedasSinResultados: n(s?.sin),
  };
}

// ── Detalle del periodo actual (una sola consulta: los CTE se calculan una vez) ──

type Row = Record<string, any>;

async function detail(period: Period, hourly: boolean) {
  const ctes = await trafficCtes(period, {});
  const fmt = hourly ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";
  const [row] = await prisma.$queryRaw<Row[]>`${ctes},
    cs AS (
      SELECT uaf."sessionId" AS skey, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS contactos
      FROM uaf WHERE uaf."action" IN ${CONTACT_ACTIONS} AND uaf."sessionId" IS NOT NULL
      GROUP BY 1
    ), fsc AS (
      SELECT fs.*, COALESCE(cs.contactos, 0) AS contactos FROM fs LEFT JOIN cs USING (skey)
    ), refs AS (
      SELECT DISTINCT split_part(pvf."path", '/', 3) AS ref, pvf.vkey FROM pvf WHERE ${profilePageSql("pvf")}
    ), fichas AS (
      SELECT COALESCE(ui."id", un."id") AS id, COUNT(DISTINCT refs.vkey)::int AS visitantes
      FROM refs
      LEFT JOIN "User" ui ON ui."id" = (CASE WHEN refs.ref ~ ${UUID_RE} THEN refs.ref::uuid END)
      LEFT JOIN "User" un ON ui."id" IS NULL AND un."username" = refs.ref
      WHERE COALESCE(ui."id", un."id") IS NOT NULL
      GROUP BY 1
    ), contactados AS (
      SELECT uaf."targetId" AS id,
        COUNT(DISTINCT ${contactKeySql("uaf")}) FILTER (WHERE uaf."action" = 'whatsapp_click')::int AS wa,
        COUNT(DISTINCT ${contactKeySql("uaf")}) FILTER (WHERE uaf."action" = 'phone_click')::int AS tel
      FROM uaf WHERE uaf."action" IN ${CONTACT_ACTIONS} AND uaf."targetId" IS NOT NULL
      GROUP BY 1
    ), perfiles AS (
      SELECT COALESCE(f.id, c.id) AS id, COALESCE(f.visitantes, 0) AS visitantes, COALESCE(c.wa, 0) AS wa, COALESCE(c.tel, 0) AS tel
      FROM fichas f FULL JOIN contactados c ON c.id = f.id
    )
    SELECT
      (SELECT COALESCE(json_agg(x ORDER BY x.sesiones DESC), '[]') FROM (
        SELECT fuente, COUNT(*)::int AS sesiones, COUNT(DISTINCT vkey)::int AS visitantes,
          COUNT(*) FILTER (WHERE pages = 1)::int AS rebotes,
          COUNT(*) FILTER (WHERE nuevo)::int AS "sesionesNuevas",
          COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto",
          COALESCE(SUM(contactos), 0)::int AS contactos
        FROM fsc GROUP BY 1) x) AS fuentes,

      (SELECT COALESCE(json_agg(x ORDER BY x.sesiones DESC), '[]') FROM (
        SELECT COALESCE("utmCampaign", '(sin nombre)') AS campana, COALESCE("utmSource", '') AS origen, COALESCE("utmMedium", '') AS medio,
          COUNT(*)::int AS sesiones, COUNT(DISTINCT vkey)::int AS visitantes,
          COUNT(*) FILTER (WHERE pages = 1)::int AS rebotes,
          COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto",
          COALESCE(SUM(contactos), 0)::int AS contactos
        FROM fsc WHERE "utmSource" IS NOT NULL OR "utmCampaign" IS NOT NULL
        GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 25) x) AS campanas,

      (SELECT COALESCE(json_agg(x ORDER BY x.sesiones DESC), '[]') FROM (
        SELECT lower(substring("referrer" from '^(?:https?://)?(?:www[.]|m[.]|l[.]|lm[.])?([^/:?#]+)')) AS dominio, fuente,
          COUNT(*)::int AS sesiones, COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto"
        FROM fsc WHERE fuente IN ('organico', 'redes', 'referidos') AND "referrer" IS NOT NULL
        GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 15) x) AS dominios,

      (SELECT COALESCE(json_agg(x ORDER BY x.entradas DESC), '[]') FROM (
        SELECT CASE
            WHEN landing = '/' THEN 'Inicio'
            WHEN landing LIKE '/profesional/%' OR landing LIKE '/escort/%' OR landing LIKE '/masajista/%' THEN 'Fichas de perfil'
            ELSE '/' || split_part(split_part(landing, '?', 1), '/', 2)
          END AS seccion,
          COUNT(*)::int AS entradas, COUNT(*) FILTER (WHERE pages = 1)::int AS rebotes,
          COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto"
        FROM fsc GROUP BY 1 ORDER BY 2 DESC LIMIT 15) x) AS "landingSecciones",

      (SELECT COALESCE(json_agg(x ORDER BY x.entradas DESC), '[]') FROM (
        SELECT split_part(landing, '?', 1) AS pagina, COUNT(*)::int AS entradas, COUNT(*) FILTER (WHERE pages = 1)::int AS rebotes,
          COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto"
        FROM fsc GROUP BY 1 ORDER BY 2 DESC LIMIT 20) x) AS landings,

      (SELECT COALESCE(json_agg(x ORDER BY x.sesiones DESC), '[]') FROM (
        SELECT COALESCE(device, 'desconocido') AS dispositivo, COUNT(*)::int AS sesiones, COUNT(DISTINCT vkey)::int AS visitantes,
          COUNT(*) FILTER (WHERE pages = 1)::int AS rebotes, COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto"
        FROM fsc GROUP BY 1) x) AS dispositivos,

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT CASE WHEN "displayMode" = 'pwa' THEN 'app' ELSE 'web' END AS modo, COUNT(*)::int AS sesiones, COUNT(DISTINCT vkey)::int AS visitantes,
          COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto"
        FROM fsc GROUP BY 1) x) AS modos,

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT CASE WHEN nuevo THEN 'nuevo' ELSE 'recurrente' END AS tipo, COUNT(*)::int AS sesiones, COUNT(DISTINCT vkey)::int AS visitantes,
          COUNT(*) FILTER (WHERE pages = 1)::int AS rebotes, COUNT(*) FILTER (WHERE contactos > 0)::int AS "sesionesConContacto"
        FROM fsc GROUP BY 1) x) AS audiencia,

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT EXTRACT(ISODOW FROM ${localTs("fsc.started")})::int AS dow, EXTRACT(HOUR FROM ${localTs("fsc.started")})::int AS hora,
          COUNT(*)::int AS sesiones, COALESCE(SUM(contactos), 0)::int AS contactos
        FROM fsc GROUP BY 1, 2) x) AS heatmap,

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT to_char(${localTs("fs.started")}, ${fmt}) AS t, COUNT(DISTINCT vkey)::int AS visitantes, COUNT(*)::int AS sesiones
        FROM fs GROUP BY 1) x) AS "serieTrafico",

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT to_char(${localTs('uaf."createdAt"')}, ${fmt}) AS t, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS contactos
        FROM uaf WHERE uaf."action" IN ${CONTACT_ACTIONS} GROUP BY 1) x) AS "serieContactos",

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT vcity AS ciudad, COUNT(*)::int AS sesiones, COUNT(DISTINCT vkey)::int AS visitantes, COALESCE(SUM(contactos), 0)::int AS contactos
        FROM fsc GROUP BY 1 ORDER BY 2 DESC LIMIT 600) x) AS ciudades,

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT pr.id, u."displayName" AS nombre, u."username", u."city" AS ciudad, u."profileType"::text AS tipo, u."tier"::text AS tier,
          pr.visitantes, pr.wa, pr.tel
        FROM perfiles pr JOIN "User" u ON u."id" = pr.id AND ${realUserSql("u")} AND u."profileType"::text IN ${OFFER_TYPES}
        ORDER BY (pr.wa + pr.tel) DESC, pr.visitantes DESC LIMIT 15) x) AS "topContactos",

      (SELECT COALESCE(json_agg(x), '[]') FROM (
        SELECT pr.id, u."displayName" AS nombre, u."username", u."city" AS ciudad, u."profileType"::text AS tipo, u."tier"::text AS tier,
          pr.visitantes, pr.wa, pr.tel
        FROM perfiles pr JOIN "User" u ON u."id" = pr.id AND ${realUserSql("u")} AND u."profileType"::text IN ${OFFER_TYPES}
        WHERE pr.visitantes >= 15 AND (pr.wa + pr.tel)::float8 / pr.visitantes < 0.03
        ORDER BY pr.visitantes DESC LIMIT 10) x) AS "bajaConversion",

      (SELECT json_build_object(
          'brutas', COUNT(*)::int,
          'bots', COUNT(*) FILTER (WHERE pv."userAgent" ~* ${BOT_UA_PATTERN})::int,
          'equipo', COUNT(*) FILTER (WHERE pv."userId" IN ${staffIdsSql()})::int,
          'panel', COUNT(*) FILTER (WHERE pv."path" LIKE '/admin%')::int)
        FROM "PageView" pv WHERE pv."createdAt" >= ${period.from} AND pv."createdAt" < ${period.to}) AS excluido`;
  return row;
}

/**
 * Registros por fuente de la primera visita (first touch): el navegador con
 * el que se registró la persona y la primera vista que dejó ese navegador.
 */
async function signupsBySource(range: Range, fmt: string) {
  return prisma.$queryRaw<{ fuente: string; campana: string | null; tipo: string; t: string; registros: number }[]>`
    WITH su AS (
      SELECT u."id", u."profileType"::text AS tipo, u."createdAt" FROM "User" u
      WHERE u."createdAt" >= ${range.from} AND u."createdAt" < ${range.to} AND ${realUserSql("u")} AND u."adminManaged" = false
    ), sv AS (
      SELECT DISTINCT ON (su."id") su."id", pv."visitorId"
      FROM su JOIN "PageView" pv ON pv."userId" = su."id" AND pv."visitorId" IS NOT NULL
      ORDER BY su."id", pv."createdAt"
    ), ft AS (
      SELECT DISTINCT ON (sv."id") sv."id", ${sourceSql("pv")} AS fuente, pv."utmCampaign" AS campana
      FROM sv JOIN "PageView" pv ON pv."visitorId" = sv."visitorId"
      ORDER BY sv."id", pv."createdAt"
    )
    SELECT COALESCE(ft.fuente, 'sin_dato') AS fuente, ft.campana,
      CASE WHEN su.tipo IN ('PROFESSIONAL', 'ESTABLISHMENT', 'SHOP') THEN 'oferente' ELSE 'cliente' END AS tipo,
      to_char(${localTs('su."createdAt"')}, ${fmt}) AS t, COUNT(*)::int AS registros
    FROM su LEFT JOIN ft ON ft."id" = su."id"
    GROUP BY 1, 2, 3, 4`;
}

async function searches(range: Range) {
  const created = Prisma.sql`sl."createdAt" >= ${range.from} AND sl."createdAt" < ${range.to}`;
  const [terminos, sinResultados] = await Promise.all([
    prisma.$queryRaw<{ termino: string; busquedas: number; sinResultados: number }[]>`
      SELECT lower(trim(sl."q")) AS termino, COUNT(*)::int AS busquedas, COUNT(*) FILTER (WHERE sl."resultCount" = 0)::int AS "sinResultados"
      FROM "SearchLog" sl WHERE ${created} AND sl."q" IS NOT NULL AND trim(sl."q") <> ''
      GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    prisma.$queryRaw<{ termino: string; ciudad: string | null; categoria: string | null; veces: number }[]>`
      SELECT COALESCE(lower(trim(sl."q")), '(sin término)') AS termino, sl."city" AS ciudad, sl."categorySlug" AS categoria, COUNT(*)::int AS veces
      FROM "SearchLog" sl WHERE ${created} AND sl."resultCount" = 0
      GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 15`,
  ]);
  return { terminos, sinResultados };
}

async function business(range: Range) {
  const billing = await getBillingSettings();
  const now = new Date();
  const trialMs = billing.trialDays * 24 * 60 * 60 * 1000;
  const trialCutoff = new Date(now.getTime() - trialMs);
  const [[r], porProposito, ofertaCiudades] = await Promise.all([
    prisma.$queryRaw<Row[]>`
      SELECT
        COUNT(*) FILTER (WHERE u."isActive" AND u."isVerified")::int AS publicados,
        COUNT(*) FILTER (WHERE u."membershipExpiresAt" > now())::int AS membresias,
        COUNT(*) FILTER (WHERE (u."membershipExpiresAt" IS NULL OR u."membershipExpiresAt" <= now())
          AND (u."createdAt" > ${trialCutoff} OR u."shopTrialEndsAt" > now()))::int AS en_prueba,
        COUNT(*) FILTER (WHERE u."membershipExpiresAt" > now() AND u."membershipExpiresAt" <= now() + interval '7 days')::int AS vencen_7d,
        COUNT(*) FILTER (WHERE u."membershipExpiresAt" >= ${range.from} AND u."membershipExpiresAt" < LEAST(${range.to}, now()))::int AS vencidas_periodo
      FROM "User" u
      WHERE u."profileType"::text IN ${OFFER_TYPES} AND ${realUserSql("u")} AND u."deletedAt" IS NULL`,
    prisma.$queryRaw<{ proposito: string; monto: number; pagos: number }[]>`
      SELECT pi."purpose"::text AS proposito, COALESCE(SUM(pi."amount"), 0)::bigint AS monto, COUNT(*)::int AS pagos
      FROM "PaymentIntent" pi
      WHERE pi."status" = 'PAID' AND pi."paidAt" >= ${range.from} AND pi."paidAt" < ${range.to}
      GROUP BY 1 ORDER BY 2 DESC`,
    prisma.$queryRaw<{ ciudad: string | null; perfiles: number }[]>`
      SELECT u."city" AS ciudad, COUNT(*)::int AS perfiles FROM "User" u
      WHERE u."profileType"::text IN ${OFFER_TYPES} AND ${realUserSql("u")} AND u."isActive" AND u."isVerified" AND u."deletedAt" IS NULL
      GROUP BY 1`,
  ]);
  return {
    precioMembresiaClp: billing.priceClp,
    cobroActivo: billing.enabled,
    perfilesPublicados: n(r?.publicados),
    membresiasActivas: n(r?.membresias),
    perfilesEnPrueba: n(r?.en_prueba),
    membresiasPorVencer7d: n(r?.vencen_7d),
    membresiasVencidasEnPeriodo: n(r?.vencidas_periodo),
    mrrEstimadoClp: n(r?.membresias) * billing.priceClp,
    porProposito: porProposito.map((p) => ({ proposito: p.proposito, monto: n(p.monto), pagos: p.pagos })),
    ofertaCiudades,
  };
}

// ── Armado ─────────────────────────────────────────────────────────────────

function buckets(period: Period, hourly: boolean): string[] {
  const out: string[] = [];
  if (hourly) {
    const ymd = chileToday(period.from);
    const end = period.to.getTime();
    for (let h = 0; h < 24; h++) {
      const key = `${ymd} ${String(h).padStart(2, "0")}:00`;
      // Las horas que aún no pasan no se muestran (salen como 0 y parecen caída).
      const start = chileMidnight(ymd).getTime() + h * 3600_000;
      if (start < end) out.push(key);
    }
    return out;
  }
  let d = chileToday(period.from);
  const last = chileToday(new Date(period.to.getTime() - 1));
  while (d <= last && out.length < 400) {
    out.push(d);
    d = addDaysYmd(d, 1);
  }
  return out;
}

const FUENTE_LABEL: Record<string, string> = {
  organico: "Google / buscadores",
  directo: "Directo",
  redes: "Redes sociales",
  referidos: "Otros sitios",
  ads: "Publicidad pagada",
  campana: "Campañas (UTM)",
  sin_dato: "Sin dato",
};

const OTRA_CIUDAD = "Extranjero / otra";

type Insight = { tipo: "alerta" | "oportunidad" | "dato"; titulo: string; detalle: string };

function rate(part: number, total: number) {
  return total ? part / total : 0;
}

function buildInsights(ctx: {
  actual: Kpis;
  anterior: Kpis;
  fuentes: { fuente: string; sesiones: number; rebotePct: number | null; conversionPct: number | null; registros: number }[];
  landings: { pagina: string; entradas: number; rebotePct: number | null }[];
  ciudades: { ciudad: string; visitantes: number; perfiles: number; contactos: number }[];
  sinResultados: { termino: string; ciudad: string | null; categoria: string | null; veces: number }[];
  bajaConversion: { nombre: string; visitantes: number; contactos: number }[];
  picos: { dia: string; hora: number; sesiones: number }[];
  dispositivos: { dispositivo: string; sesiones: number }[];
  campanas: number;
  negocio: { membresiasPorVencer7d: number; perfilesEnPrueba: number };
}): Insight[] {
  const out: Insight[] = [];
  const { actual: a, anterior: b } = ctx;

  // Caídas y subidas fuertes en lo que importa (sólo con base suficiente).
  const watch: [keyof Kpis, string][] = [
    ["visitantes", "Visitantes"],
    ["leads", "Leads"],
    ["registrosOferentes", "Registros de anunciantes"],
    ["registrosClientes", "Registros de clientes"],
    ["ingresosClp", "Ingresos"],
  ];
  for (const [k, label] of watch) {
    const cur = a[k] as number;
    const prev = b[k] as number;
    const d = deltaPct(cur, prev);
    if (d === null || Math.max(cur, prev) < (k === "ingresosClp" ? 100_000 : 30)) continue;
    if (d <= -20) out.push({ tipo: "alerta", titulo: `${label} cayeron ${Math.abs(d)}%`, detalle: `${prev.toLocaleString("es-CL")} → ${cur.toLocaleString("es-CL")} contra el periodo anterior. Revisa fuentes y campañas para ver de dónde viene la baja.` });
    else if (d >= 25) out.push({ tipo: "dato", titulo: `${label} subieron ${d}%`, detalle: `${prev.toLocaleString("es-CL")} → ${cur.toLocaleString("es-CL")}. Mira en Adquisición qué canal lo explica y refuérzalo.` });
  }

  // Mejor canal por conversión (con volumen suficiente).
  const conVolumen = ctx.fuentes.filter((f) => f.sesiones >= 50 && f.conversionPct !== null);
  if (conVolumen.length >= 2) {
    const best = conVolumen.slice().sort((x, y) => (y.conversionPct ?? 0) - (x.conversionPct ?? 0))[0];
    const totSes = ctx.fuentes.reduce((acc, f) => acc + f.sesiones, 0);
    const totConv = ctx.fuentes.reduce((acc, f) => acc + (f.sesiones * (f.conversionPct ?? 0)) / 100, 0);
    const avg = rate(totConv, totSes) * 100;
    if (best && avg > 0 && (best.conversionPct ?? 0) >= avg * 1.3) {
      out.push({ tipo: "oportunidad", titulo: `${FUENTE_LABEL[best.fuente] ?? best.fuente} es el canal que más convierte`, detalle: `${best.conversionPct}% de sus sesiones termina en contacto (promedio del sitio ≈ ${avg.toFixed(1)}%). Es el canal donde más rinde invertir.` });
    }
    const worstBounce = conVolumen.filter((f) => (f.rebotePct ?? 0) >= 70).sort((x, y) => y.sesiones - x.sesiones)[0];
    if (worstBounce) {
      out.push({ tipo: "alerta", titulo: `${FUENTE_LABEL[worstBounce.fuente] ?? worstBounce.fuente}: ${worstBounce.rebotePct}% de rebote`, detalle: `La mayoría entra y se va sin ver otra página. Revisa que el anuncio o enlace lleve a una página que muestre lo que promete.` });
    }
  }

  if (ctx.campanas === 0) {
    out.push({ tipo: "dato", titulo: "No hay campañas etiquetadas", detalle: "Ninguna visita del periodo trae parámetros UTM. Agrega ?utm_source=instagram&utm_medium=social&utm_campaign=nombre a los enlaces que publiques para saber qué campaña trae contactos y registros." });
  }

  const landing = ctx.landings.filter((l) => l.entradas >= 40 && (l.rebotePct ?? 0) >= 75).sort((x, y) => y.entradas - x.entradas)[0];
  if (landing) {
    out.push({ tipo: "alerta", titulo: `Página de entrada con ${landing.rebotePct}% de rebote`, detalle: `${landing.pagina === "/" ? "La portada (/)" : landing.pagina} recibe ${landing.entradas} entradas y casi todos se van sin seguir. Agrega perfiles destacados, filtros visibles o un llamado a la acción.` });
  }

  const demanda = ctx.ciudades
    .filter((c) => c.visitantes >= 40 && c.ciudad !== "(sin ciudad)" && c.ciudad !== OTRA_CIUDAD)
    .map((c) => ({ ...c, ratio: c.visitantes / Math.max(c.perfiles, 1) }))
    .sort((x, y) => y.ratio - x.ratio)[0];
  if (demanda && demanda.ratio >= 30) {
    out.push({ tipo: "oportunidad", titulo: `${demanda.ciudad}: mucha demanda y poca oferta`, detalle: `${demanda.visitantes} visitantes y ${demanda.perfiles ? `sólo ${demanda.perfiles} perfil(es) publicado(s)` : "ningún perfil publicado"}. Apunta la captación de anunciantes a esa ciudad.` });
  }

  const sr = ctx.sinResultados.filter((s) => s.veces >= 3)[0];
  if (sr) {
    const donde = [sr.termino !== "(sin término)" ? `"${sr.termino}"` : null, sr.categoria, sr.ciudad].filter(Boolean).join(" · ");
    out.push({ tipo: "oportunidad", titulo: "Búsquedas que no encuentran nada", detalle: `${donde || "Una búsqueda"} se buscó ${sr.veces} veces sin resultados. Es demanda que se está perdiendo: capta perfiles para eso o redirige a algo parecido.` });
  }

  const flojo = ctx.bajaConversion.filter((p) => p.visitantes >= 40 && rate(p.contactos, p.visitantes) < 0.02)[0];
  if (flojo) {
    out.push({ tipo: "oportunidad", titulo: `${flojo.nombre}: muchas visitas, casi sin contactos`, detalle: `${flojo.visitantes} visitantes y ${flojo.contactos} contactos. Suele ser foto de portada, tarifa o descripción: vale la pena sugerirle cambios.` });
  }

  const pico = ctx.picos[0];
  if (pico) {
    out.push({ tipo: "dato", titulo: `El tráfico máximo es el ${pico.dia} a las ${String(pico.hora).padStart(2, "0")}:00`, detalle: "Programa publicaciones en redes, historias y campañas pagadas un rato antes de esa hora." });
  }

  const totalSes = ctx.dispositivos.reduce((s, d) => s + d.sesiones, 0);
  const movil = ctx.dispositivos.find((d) => d.dispositivo === "mobile")?.sesiones ?? 0;
  if (totalSes >= 50 && movil / totalSes >= 0.7) {
    out.push({ tipo: "dato", titulo: `${Math.round((movil / totalSes) * 100)}% del tráfico es móvil`, detalle: "Diseña creatividades y páginas de aterrizaje pensando primero en el teléfono." });
  }

  if (ctx.negocio.membresiasPorVencer7d > 0) {
    out.push({ tipo: "alerta", titulo: `${ctx.negocio.membresiasPorVencer7d} membresía(s) vencen en 7 días`, detalle: "Contáctalas antes del vencimiento con sus métricas (visitas y contactos) para que renueven." });
  }

  const order = { alerta: 0, oportunidad: 1, dato: 2 } as const;
  return out.sort((x, y) => order[x.tipo] - order[y.tipo]);
}

const cache = new Map<string, { at: number; data: unknown }>();
const CACHE_MS = 5 * 60 * 1000;

export async function buildMarketingDashboard(periodKey: MarketingPeriod) {
  const hit = cache.get(periodKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const period = resolvePeriod({ periodo: periodKey } as PeriodInput);
  const hourly = periodKey === "hoy";
  const fmt = hourly ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";

  const [actual, anterior, det, signups, signupsPrev, busq, negocio] = await Promise.all([
    kpis(period),
    kpis(period.previous),
    detail(period, hourly),
    signupsBySource(period, fmt),
    signupsBySource(period.previous, fmt),
    searches(period),
    business(period),
  ]);

  // Serie temporal con huecos rellenados.
  const keys = buckets(period, hourly);
  const traf = new Map<string, Row>((det.serieTrafico as Row[]).map((r) => [r.t, r]));
  const cont = new Map<string, number>((det.serieContactos as Row[]).map((r) => [r.t, n(r.contactos)]));
  const reg = new Map<string, { clientes: number; oferentes: number }>();
  for (const s of signups) {
    const e = reg.get(s.t) ?? { clientes: 0, oferentes: 0 };
    if (s.tipo === "oferente") e.oferentes += s.registros;
    else e.clientes += s.registros;
    reg.set(s.t, e);
  }
  const serie = keys.map((k) => ({
    t: k,
    visitantes: n(traf.get(k)?.visitantes),
    sesiones: n(traf.get(k)?.sesiones),
    contactos: cont.get(k) ?? 0,
    registrosClientes: reg.get(k)?.clientes ?? 0,
    registrosOferentes: reg.get(k)?.oferentes ?? 0,
  }));

  // Adquisición: tráfico + contactos + registros por fuente.
  const regPorFuente = new Map<string, { clientes: number; oferentes: number }>();
  for (const s of signups) {
    const e = regPorFuente.get(s.fuente) ?? { clientes: 0, oferentes: 0 };
    if (s.tipo === "oferente") e.oferentes += s.registros;
    else e.clientes += s.registros;
    regPorFuente.set(s.fuente, e);
  }
  const regPrevPorFuente = new Map<string, number>();
  for (const s of signupsPrev) regPrevPorFuente.set(s.fuente, (regPrevPorFuente.get(s.fuente) ?? 0) + s.registros);

  const fuentesRaw = det.fuentes as Row[];
  const fuenteKeys = new Set([...fuentesRaw.map((f) => f.fuente as string), ...regPorFuente.keys()]);
  const fuentes = [...fuenteKeys]
    .map((k) => {
      const f = fuentesRaw.find((x) => x.fuente === k) ?? {};
      const r = regPorFuente.get(k) ?? { clientes: 0, oferentes: 0 };
      const sesiones = n(f.sesiones);
      return {
        fuente: k,
        etiqueta: FUENTE_LABEL[k] ?? k,
        sesiones,
        visitantes: n(f.visitantes),
        nuevosPct: pct(n(f.sesionesNuevas), sesiones),
        rebotePct: pct(n(f.rebotes), sesiones),
        contactos: n(f.contactos),
        conversionPct: pct(n(f.sesionesConContacto), sesiones),
        registrosClientes: r.clientes,
        registrosOferentes: r.oferentes,
        registros: r.clientes + r.oferentes,
        registrosAnterior: regPrevPorFuente.get(k) ?? 0,
      };
    })
    .sort((x, y) => y.sesiones - x.sesiones);

  const regPorCampana = new Map<string, number>();
  for (const s of signups) if (s.campana) regPorCampana.set(s.campana, (regPorCampana.get(s.campana) ?? 0) + s.registros);
  const campanas = (det.campanas as Row[]).map((c) => ({
    campana: c.campana,
    origen: c.origen,
    medio: c.medio,
    sesiones: n(c.sesiones),
    visitantes: n(c.visitantes),
    rebotePct: pct(n(c.rebotes), n(c.sesiones)),
    contactos: n(c.contactos),
    conversionPct: pct(n(c.sesionesConContacto), n(c.sesiones)),
    registros: regPorCampana.get(c.campana) ?? 0,
  }));

  const withRates = (rows: Row[], key: string) =>
    rows.map((r) => ({
      [key]: r[key],
      entradas: n(r.entradas),
      rebotePct: pct(n(r.rebotes), n(r.entradas)),
      conversionPct: pct(n(r.sesionesConContacto), n(r.entradas)),
    })) as { pagina: string; seccion: string; entradas: number; rebotePct: number | null; conversionPct: number | null }[];
  const landings = withRates(det.landings as Row[], "pagina");
  const landingSecciones = withRates(det.landingSecciones as Row[], "seccion");

  const segment = (rows: Row[], key: string) =>
    rows.map((r) => ({
      clave: r[key] as string,
      sesiones: n(r.sesiones),
      visitantes: n(r.visitantes),
      rebotePct: r.rebotes !== undefined ? pct(n(r.rebotes), n(r.sesiones)) : null,
      conversionPct: pct(n(r.sesionesConContacto), n(r.sesiones)),
    }));
  const dispositivos = segment(det.dispositivos as Row[], "dispositivo");
  const modos = segment(det.modos as Row[], "modo");
  const audiencia = segment(det.audiencia as Row[], "tipo");

  // Heatmap día × hora.
  const dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const matriz = dias.map(() => Array(24).fill(0) as number[]);
  for (const h of det.heatmap as Row[]) matriz[n(h.dow) - 1][n(h.hora)] = n(h.sesiones);
  const picos = (det.heatmap as Row[])
    .slice()
    .sort((x, y) => n(y.sesiones) - n(x.sesiones))
    .slice(0, 3)
    .map((h) => ({ dia: dias[n(h.dow) - 1], hora: n(h.hora), sesiones: n(h.sesiones) }));

  // Demanda (visitantes por ciudad del visitante) vs oferta (perfiles publicados).
  const geo = new Map<string, { ciudad: string; region: string; sesiones: number; visitantes: number; contactos: number; perfiles: number }>();
  const geoGet = (ciudad: string, region: string) => {
    const e = geo.get(ciudad) ?? { ciudad, region, sesiones: 0, visitantes: 0, contactos: 0, perfiles: 0 };
    geo.set(ciudad, e);
    return e;
  };
  for (const c of det.ciudades as Row[]) {
    const g = normalizeCity(c.ciudad);
    const e = geoGet(g.sinNormalizar && c.ciudad ? OTRA_CIUDAD : g.ciudad, g.sinNormalizar && c.ciudad ? "—" : g.region);
    e.sesiones += n(c.sesiones);
    e.visitantes += n(c.visitantes);
    e.contactos += n(c.contactos);
  }
  for (const o of negocio.ofertaCiudades) {
    const g = normalizeCity(o.ciudad);
    if (g.sinNormalizar) continue;
    geoGet(g.ciudad, g.region).perfiles += o.perfiles;
  }
  const ciudades = [...geo.values()]
    .map((c) => ({ ...c, visitantesPorPerfil: c.perfiles ? Math.round((c.visitantes / c.perfiles) * 10) / 10 : null }))
    .sort((x, y) => y.visitantes - x.visitantes)
    .slice(0, 20);

  const perfilRow = (p: Row) => ({
    id: p.id,
    nombre: p.nombre || p.username || "Sin nombre",
    username: p.username,
    ciudad: p.ciudad,
    tipo: p.tipo,
    tier: p.tier,
    visitantes: n(p.visitantes),
    whatsapp: n(p.wa),
    telefono: n(p.tel),
    contactos: n(p.wa) + n(p.tel),
    tasaContactoPct: pct(n(p.wa) + n(p.tel), n(p.visitantes)),
  });
  const topContactos = (det.topContactos as Row[]).map(perfilRow);
  const bajaConversion = (det.bajaConversion as Row[]).map(perfilRow);

  const ex = det.excluido as Row;
  const excluido = {
    brutas: n(ex?.brutas),
    bots: n(ex?.bots),
    equipo: n(ex?.equipo),
    panel: n(ex?.panel),
    reales: actual.vistas,
  };

  const comparacion = Object.fromEntries(
    (Object.keys(actual) as (keyof Kpis)[]).map((k) => {
      const cur = actual[k] ?? 0;
      const prev = anterior[k] ?? 0;
      const isRate = k.endsWith("Pct") || k === "paginasPorSesion" || k === "duracionMedianaSeg";
      return [
        k,
        {
          actual: cur,
          anterior: prev,
          // Las tasas se comparan en puntos; los conteos en %.
          variacionPct: isRate ? null : deltaPct(cur ?? 0, prev ?? 0),
          diferencia: Math.round(((cur ?? 0) - (prev ?? 0)) * 10) / 10,
          baseChica: !isRate && !k.endsWith("Clp") && Math.max(cur ?? 0, prev ?? 0) < 20 ? true : undefined,
        },
      ];
    }),
  );

  const { ofertaCiudades: _o, ...negocioOut } = negocio;
  const data = {
    generadoEl: new Date().toISOString(),
    periodo: {
      clave: periodKey,
      etiqueta: period.label,
      anterior: period.previous.label,
      dias: period.days,
      enCurso: period.inProgress,
      agrupacion: hourly ? "hora" : "dia",
    },
    kpis: comparacion,
    embudo: [
      { paso: "Visitantes únicos", valor: actual.visitantes, anterior: anterior.visitantes },
      { paso: "Vieron una ficha", valor: actual.visitantesFichas, anterior: anterior.visitantesFichas },
      { paso: "Contactaron (WhatsApp / llamada)", valor: actual.visitantesQueContactaron, anterior: anterior.visitantesQueContactaron },
    ],
    serie,
    fuentes,
    campanas,
    dominios: (det.dominios as Row[]).map((d) => ({
      dominio: d.dominio || "(desconocido)",
      fuente: d.fuente,
      sesiones: n(d.sesiones),
      conversionPct: pct(n(d.sesionesConContacto), n(d.sesiones)),
    })),
    landingSecciones,
    landings,
    dispositivos,
    modos,
    audiencia,
    heatmap: { dias, matriz, picos },
    ciudades,
    busquedas: busq,
    perfiles: { topContactos, bajaConversion },
    negocio: {
      ...negocioOut,
      ingresosClp: actual.ingresosClp,
      ticketPromedioClp: actual.pagos ? Math.round(actual.ingresosClp / actual.pagos) : null,
      leadsPorPerfilPublicado: negocio.perfilesPublicados ? Math.round((actual.leads / negocio.perfilesPublicados) * 10) / 10 : null,
    },
    excluido,
    insights: [] as Insight[],
    criterios: {
      trafico: "Sin bots, sin el equipo y sin páginas /admin. Visitante = navegador; sesión = pestaña.",
      contacto: "Click en WhatsApp o llamar, contado una vez por persona, perfil y día.",
      lead: "Contactos + conversaciones nuevas de clientes con perfiles por el chat.",
      tasaContacto: "Visitantes que contactaron ÷ visitantes que vieron al menos una ficha.",
      conversion: "Por canal o página: % de sesiones que terminan en al menos un contacto.",
      registros: "Altas reales (sin prueba, equipo ni cargas del admin). La fuente es la primera visita del navegador con que se registró.",
      ingresos: "Pagos confirmados + transferencias aprobadas, sin duplicar depósitos por Flow.",
      comparacion: period.inProgress
        ? "Contra el periodo anterior del mismo largo, hasta la misma hora."
        : "Contra el periodo anterior del mismo largo.",
    },
  };

  data.insights = buildInsights({
    actual,
    anterior,
    fuentes,
    landings,
    ciudades: ciudades.map((c) => ({ ciudad: c.ciudad, visitantes: c.visitantes, perfiles: c.perfiles, contactos: c.contactos })),
    sinResultados: busq.sinResultados,
    bajaConversion: bajaConversion.map((p) => ({ nombre: p.nombre, visitantes: p.visitantes, contactos: p.contactos })),
    picos,
    dispositivos: dispositivos.map((d) => ({ dispositivo: d.clave, sesiones: d.sesiones })),
    campanas: campanas.length,
    negocio,
  });

  cache.set(periodKey, { at: Date.now(), data });
  return data;
}
