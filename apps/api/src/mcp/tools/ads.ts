import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { MIN_PROFILE_PHOTOS, REQUIRED_PROFILE_FIELDS, missingProfileFields } from "../../lib/profileCompletion";
import { guarded, type McpContext } from "../audit";
import { TZ, describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { describeFiltros, filtrosShape, pickFiltros, profileSql, withSegment, type Filtros } from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const MS_DAY = 24 * 60 * 60 * 1000;

const BUSINESS = Prisma.sql`u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP')`;

/**
 * Métricas de exposición por perfil en un rango: impresiones, posición media,
 * vistas, visitantes, contactos (WhatsApp, teléfono, mensajes internos) y
 * favoritos. Es la base del ranking, el embudo, la dispersión y las alertas.
 */
async function exposureRows(range: { from: Date; to: Date }, f: Filtros) {
  const pf = await profileSql(f, "u");
  const dFrom = Prisma.sql`(${range.from}::timestamptz AT TIME ZONE ${TZ})::date`;
  const dTo = Prisma.sql`(${range.to}::timestamptz AT TIME ZONE ${TZ})::date`;
  const real = Prisma.sql`pv."path" NOT LIKE '/admin%' AND (pv."userAgent" IS NULL OR pv."userAgent" !~* 'bot|crawl|spider|headless|lighthouse|python|curl')`;
  return prisma.$queryRaw<
    {
      id: string; username: string; displayName: string | null; city: string | null; tier: string | null; categoria: string | null;
      isActive: boolean; isVerified: boolean; impresiones: number; posicionMedia: number | null; vistas: number; visitantes: number;
      whatsapp: number; telefono: number; mensajes: number; favoritos: number;
    }[]
  >`
    WITH base AS (SELECT u."id", u."username", u."displayName", u."city", u."tier"::text AS tier, COALESCE(u."primaryCategory", u."serviceCategory") AS categoria, u."isActive", u."isVerified"
                  FROM "User" u WHERE ${pf} AND ${BUSINESS}),
    imp AS (SELECT d."profileId" AS id, SUM(d.impressions)::int AS impresiones, (SUM(d."positionSum")::float8 / NULLIF(SUM(d.impressions), 0)) AS pos
            FROM "ProfileDailyStats" d WHERE d."date" >= ${dFrom} AND d."date" <= ${dTo} GROUP BY 1),
    views AS (SELECT b."id", COUNT(*)::int AS vistas, COUNT(DISTINCT COALESCE(pv."visitorId", pv."sessionId", pv."id"::text))::int AS visitantes
              FROM "PageView" pv JOIN base b ON split_part(pv."path", '/', 3) IN (b."id"::text, b."username")
              WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to} AND ${real} GROUP BY 1),
    acts AS (SELECT ua."targetId" AS id,
               COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD'))) FILTER (WHERE ua."action" = 'whatsapp_click')::int AS whatsapp,
               COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD'))) FILTER (WHERE ua."action" = 'phone_click')::int AS telefono
             FROM "UserAction" ua JOIN base b ON b."id" = ua."targetId"
             WHERE ua."createdAt" >= ${range.from} AND ua."createdAt" < ${range.to}
               AND (ua."userId" IS NULL OR ua."userId" NOT IN (SELECT "id" FROM "User" WHERE "role" IN ('ADMIN','MODERATOR'))) GROUP BY 1),
    msgs AS (SELECT m."toId" AS id, COUNT(DISTINCT m."fromId")::int AS mensajes FROM "Message" m JOIN base b ON b."id" = m."toId"
             WHERE m."createdAt" >= ${range.from} AND m."createdAt" < ${range.to} GROUP BY 1),
    favs AS (SELECT fv."professionalId" AS id, COUNT(*)::int AS favoritos FROM "Favorite" fv JOIN base b ON b."id" = fv."professionalId"
             WHERE fv."createdAt" >= ${range.from} AND fv."createdAt" < ${range.to} GROUP BY 1)
    SELECT b.*, COALESCE(imp.impresiones, 0) AS impresiones, imp.pos AS "posicionMedia",
      COALESCE(views.vistas, 0) AS vistas, COALESCE(views.visitantes, 0) AS visitantes,
      COALESCE(acts.whatsapp, 0) AS whatsapp, COALESCE(acts.telefono, 0) AS telefono,
      COALESCE(msgs.mensajes, 0) AS mensajes, COALESCE(favs.favoritos, 0) AS favoritos
    FROM base b LEFT JOIN imp USING (id) LEFT JOIN views USING (id) LEFT JOIN acts USING (id) LEFT JOIN msgs USING (id) LEFT JOIN favs USING (id)`;
}

type Exposure = Awaited<ReturnType<typeof exposureRows>>[number];

function enrich(r: Exposure) {
  const contactos = r.whatsapp + r.telefono + r.mensajes;
  return {
    id: r.id,
    username: r.username,
    nombre: r.displayName,
    ciudad: r.city,
    tier: r.tier ?? "NINGUNO",
    categoria: r.categoria,
    impresiones: r.impresiones,
    posicionMedia: r.posicionMedia != null ? Math.round(Number(r.posicionMedia) * 10) / 10 : null,
    vistas: r.vistas,
    visitantes: r.visitantes,
    ctrListadoPct: r.impresiones ? Math.round((r.vistas / r.impresiones) * 1000) / 10 : null,
    contactos: { whatsapp: r.whatsapp, telefono: r.telefono, mensajes: r.mensajes, total: contactos },
    tasaContactoPct: r.visitantes ? Math.round((contactos / r.visitantes) * 1000) / 10 : null,
    favoritos: r.favoritos,
  };
}

type Enriched = ReturnType<typeof enrich>;

const ORDEN = ["vistas", "visitantes", "contactos", "tasa_contacto", "favoritos", "impresiones", "ctr", "posicion"] as const;
const sortKey: Record<(typeof ORDEN)[number], (r: Enriched) => number> = {
  vistas: (r) => r.vistas,
  visitantes: (r) => r.visitantes,
  contactos: (r) => r.contactos.total,
  tasa_contacto: (r) => (r.visitantes >= 10 ? r.tasaContactoPct ?? 0 : -1),
  favoritos: (r) => r.favoritos,
  impresiones: (r) => r.impresiones,
  ctr: (r) => (r.impresiones >= 20 ? r.ctrListadoPct ?? 0 : -1),
  posicion: (r) => (r.posicionMedia != null ? -r.posicionMedia : -1e9),
};

export function registerAdsTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "inventario_anuncios",
    {
      title: "Estado del inventario de anuncios",
      description:
        "Cuántos anuncios (perfiles de negocio) hay en cada estado: publicados (activos y verificados), pendientes de verificación, ocultos, rechazados; y en el periodo: nuevos, editados, publicados por primera vez, vencidos de membresía. Con desglose por tipo de perfil, tier y ciudad. Acepta filtros comunes.",
      inputSchema: { ...periodShape, ...filtrosShape },
      annotations: READ,
    },
    guarded("inventario_anuncios", ctx, async (args: PeriodInput & Filtros) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const pf = await profileSql(f, "u");
      const inRange = (col: string) => Prisma.sql`u.${Prisma.raw(`"${col}"`)} >= ${period.from} AND u.${Prisma.raw(`"${col}"`)} < ${period.to}`;
      const [estados, porTipo, porTier, porCiudad, periodo] = await Promise.all([
        prisma.$queryRaw<{ estado: string; total: number }[]>`
          SELECT CASE WHEN u."isActive" AND u."isVerified" THEN 'publicado' WHEN u."isActive" THEN 'pendiente' WHEN u."isVerified" THEN 'oculto' ELSE 'rechazado' END AS estado, COUNT(*)::int AS total
          FROM "User" u WHERE ${pf} AND ${BUSINESS} GROUP BY 1 ORDER BY 2 DESC`,
        prisma.$queryRaw<{ tipo: string; publicados: number; total: number }[]>`
          SELECT u."profileType"::text AS tipo, COUNT(*) FILTER (WHERE u."isActive" AND u."isVerified")::int AS publicados, COUNT(*)::int AS total
          FROM "User" u WHERE ${pf} AND ${BUSINESS} GROUP BY 1 ORDER BY 3 DESC`,
        prisma.$queryRaw<{ tier: string; publicados: number }[]>`
          SELECT COALESCE(u."tier"::text, 'NINGUNO') AS tier, COUNT(*)::int AS publicados FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."isActive" AND u."isVerified" GROUP BY 1 ORDER BY 2 DESC`,
        prisma.$queryRaw<{ ciudad: string; publicados: number }[]>`
          SELECT COALESCE(u."city", '(sin ciudad)') AS ciudad, COUNT(*)::int AS publicados FROM "User" u WHERE ${pf} AND ${BUSINESS} AND u."isActive" AND u."isVerified" GROUP BY 1 ORDER BY 2 DESC LIMIT 30`,
        prisma.$queryRaw<{ nuevos: number; editados: number; publicadosPrimeraVez: number; verificados: number; vencidos: number; cargadosAdmin: number }[]>`
          SELECT
            COUNT(*) FILTER (WHERE ${inRange("createdAt")} AND u."adminManaged" = false)::int AS nuevos,
            COUNT(*) FILTER (WHERE ${inRange("lastEditedAt")} AND NOT (${inRange("createdAt")}))::int AS editados,
            COUNT(*) FILTER (WHERE ${inRange("profileCompletedAt")})::int AS "publicadosPrimeraVez",
            COUNT(*) FILTER (WHERE ${inRange("verifiedAt")})::int AS verificados,
            COUNT(*) FILTER (WHERE ${inRange("membershipExpiresAt")})::int AS vencidos,
            COUNT(*) FILTER (WHERE ${inRange("createdAt")} AND u."adminManaged")::int AS "cargadosAdmin"
          FROM "User" u WHERE ${pf} AND ${BUSINESS}`,
      ]);
      return jsonResult({
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        fotoActual: { porEstado: estados, porTipo, publicadosPorTier: porTier, publicadosPorCiudad: porCiudad },
        enElPeriodo: periodo[0],
        criterio: "publicado = activo y verificado; pendiente = activo sin verificar; oculto = desactivado; rechazado = desactivado sin verificar. Editados = tocaron su ficha (datos, fotos o tarifas) y no son nuevos.",
        grafico: "dona por estado",
      });
    }),
  );

  server.registerTool(
    "exposicion_anuncios",
    {
      title: "Exposición y conversión de anuncios",
      description:
        "Por anuncio: impresiones en listados, posición media en el listado, vistas del perfil, visitantes, CTR listado→perfil, contactos (WhatsApp, llamada y mensaje interno, únicos por persona y día), tasa contacto/visitante (la conversión real) y favoritos. Devuelve el ranking ordenable (ordenarPor), el embudo agregado impresión → vista → contacto y la dispersión vistas vs contactos para graficar. Acepta filtros comunes.",
      inputSchema: {
        ...periodShape,
        ...filtrosShape,
        ordenarPor: z.enum(ORDEN).optional().describe("Por defecto vistas. tasa_contacto y ctr exigen un mínimo de base (10 visitantes / 20 impresiones)."),
        limite: z.number().int().min(1).max(200).optional().describe("Tamaño del ranking (por defecto 20)."),
        incluirDispersion: z.boolean().optional().describe("Incluye hasta 500 puntos {vistas, contactos} (por defecto true)."),
      },
      annotations: READ,
    },
    guarded("exposicion_anuncios", ctx, async (args: PeriodInput & Filtros & { ordenarPor?: (typeof ORDEN)[number]; limite?: number; incluirDispersion?: boolean }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const rows = (await exposureRows(period, f)).map(enrich);
      const key = sortKey[args.ordenarPor ?? "vistas"];
      const ranking = rows.slice().sort((a, b) => key(b) - key(a)).slice(0, args.limite ?? 20).map((r, i) => ({ posicion: i + 1, ...r }));
      const sum = (fn: (r: Enriched) => number) => rows.reduce((acc, r) => acc + fn(r), 0);
      const impresiones = sum((r) => r.impresiones);
      const vistas = sum((r) => r.vistas);
      const visitantes = sum((r) => r.visitantes);
      const contactos = sum((r) => r.contactos.total);
      const conImpresiones = rows.filter((r) => r.impresiones > 0);
      return jsonResult({
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        anuncios: rows.length,
        embudo: {
          impresiones,
          vistas,
          visitantes,
          contactos,
          ctrListadoPct: impresiones ? Math.round((vistas / impresiones) * 1000) / 10 : null,
          tasaContactoPct: visitantes ? Math.round((contactos / visitantes) * 1000) / 10 : null,
          grafico: "embudo impresión → vista → contacto",
        },
        posicionMediaGlobal: conImpresiones.length
          ? Math.round((conImpresiones.reduce((a, r) => a + (r.posicionMedia ?? 0) * r.impresiones, 0) / impresiones) * 10) / 10
          : null,
        ranking: { ordenadoPor: args.ordenarPor ?? "vistas", top: ranking, grafico: "barras top 20" },
        dispersion:
          args.incluirDispersion === false
            ? undefined
            : { puntos: rows.filter((r) => r.vistas > 0 || r.contactos.total > 0).slice(0, 500).map((r) => ({ username: r.username, vistas: r.vistas, contactos: r.contactos.total, tier: r.tier })), grafico: "dispersión vistas (x) vs contactos (y)" },
        criterios: "Impresiones = apariciones en listados (agregado por día, desde que se activó la captura). Contactos únicos por persona, perfil y día. Sin bots ni equipo.",
      });
    }),
  );

  server.registerTool(
    "calidad_anuncios",
    {
      title: "Calidad de los anuncios",
      description:
        "Completitud de la ficha (fotos, descripción, tarifas, datos), número de fotos, antigüedad y última actualización de cada anuncio publicado, con distribución y la lista de los menos completos. Acepta filtros comunes.",
      inputSchema: { ...filtrosShape, limite: z.number().int().min(1).max(200).optional() },
      annotations: READ,
    },
    guarded("calidad_anuncios", ctx, async (args: Filtros & { limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const pf = await profileSql(f, "u");
      const rows = await prisma.$queryRaw<
        { id: string; username: string; displayName: string | null; tier: string | null; city: string | null; createdAt: Date; lastEditedAt: Date | null;
          fotos: number; bio: string | null; baseRate: number | null; city2: string | null; phone: string | null; birthdate: Date | null; heightCm: number | null; weightKg: number | null;
          measurements: string | null; hairColor: string | null; skinTone: string | null; serviceTags: string[]; undisclosedFields: string[]; availabilityNote: string | null; }[]
      >`
        SELECT u."id", u."username", u."displayName", u."tier"::text AS tier, u."city", u."createdAt", u."lastEditedAt",
          (SELECT COUNT(*) FROM "ProfileMedia" pm WHERE pm."ownerId" = u."id" AND pm."type" = 'IMAGE')::int AS fotos,
          u."bio", u."baseRate", u."city" AS city2, u."phone", u."birthdate", u."heightCm", u."weightKg", u."measurements", u."hairColor", u."skinTone",
          u."serviceTags", u."undisclosedFields", u."availabilityNote"
        FROM "User" u WHERE ${pf} AND u."profileType" = 'PROFESSIONAL' AND u."isActive" AND u."isVerified"`;
      const now = Date.now();
      const totalFields = REQUIRED_PROFILE_FIELDS.length;
      const items = rows.map((r) => {
        const missing = missingProfileFields(r as any, r.fotos);
        const completitud = Math.round(((totalFields - missing.length) / totalFields) * 100);
        return {
          id: r.id,
          username: r.username,
          nombre: r.displayName,
          tier: r.tier ?? "NINGUNO",
          ciudad: r.city,
          completitudPct: completitud,
          faltan: missing.map((m) => m.label),
          fotos: r.fotos,
          tieneDescripcion: (r.bio || "").trim().length >= 40,
          tieneTarifa: r.baseRate != null && r.baseRate > 0,
          tieneHorario: Boolean(r.availabilityNote),
          antiguedadDias: Math.floor((now - r.createdAt.getTime()) / MS_DAY),
          ultimaActualizacion: r.lastEditedAt,
          diasSinActualizar: r.lastEditedAt ? Math.floor((now - r.lastEditedAt.getTime()) / MS_DAY) : null,
        };
      });
      const bucket = (v: number, edges: number[]) => edges.findIndex((e) => v <= e);
      const dist = (values: number[], edges: number[], labels: string[]) => {
        const counts = labels.map(() => 0);
        for (const v of values) { const i = bucket(v, edges); counts[i === -1 ? labels.length - 1 : i]++; }
        return labels.map((l, i) => ({ rango: l, anuncios: counts[i] }));
      };
      return jsonResult({
        filtros: describeFiltros(f),
        anunciosPublicados: items.length,
        completitudPromedioPct: items.length ? Math.round(items.reduce((a, i) => a + i.completitudPct, 0) / items.length) : null,
        distribucion: {
          completitud: dist(items.map((i) => i.completitudPct), [40, 60, 80, 99], ["≤40%", "41-60%", "61-80%", "81-99%", "100%"]),
          fotos: dist(items.map((i) => i.fotos), [0, 2, MIN_PROFILE_PHOTOS - 1, 9], ["0", "1-2", `3-${MIN_PROFILE_PHOTOS - 1}`, `${MIN_PROFILE_PHOTOS}-9`, "10+"]),
          diasSinActualizar: dist(items.map((i) => i.diasSinActualizar ?? 999), [7, 30, 90], ["≤7", "8-30", "31-90", ">90"]),
          antiguedadDias: dist(items.map((i) => i.antiguedadDias), [30, 90, 365], ["≤30", "31-90", "91-365", ">365"]),
        },
        menosCompletos: items.sort((a, b) => a.completitudPct - b.completitudPct).slice(0, args.limite ?? 20),
        criterio: `Completitud = campos obligatorios de la ficha presentes (${totalFields}); "prefiero no decirlo" cuenta como resuelto. Descripción = 40+ caracteres.`,
      });
    }),
  );

  server.registerTool(
    "alertas_anuncios",
    {
      title: "Listas de alerta de anuncios",
      description:
        "Tres listas de anuncios publicados que necesitan atención en el periodo: con vistas pero sin contactos, sin vistas, y sin actualizar hace más de N días (por defecto 30). Cada una con sus números. Acepta filtros comunes.",
      inputSchema: {
        ...periodShape,
        ...filtrosShape,
        minVistas: z.number().int().min(1).optional().describe("Vistas mínimas para 'con vistas sin contactos' (por defecto 10)."),
        diasSinActualizar: z.number().int().min(1).optional().describe("Por defecto 30."),
        limite: z.number().int().min(1).max(200).optional(),
      },
      annotations: READ,
    },
    guarded("alertas_anuncios", ctx, async (args: PeriodInput & Filtros & { minVistas?: number; diasSinActualizar?: number; limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const take = args.limite ?? 30;
      const minViews = args.minVistas ?? 10;
      const staleDays = args.diasSinActualizar ?? 30;
      const rows = (await exposureRows(period, f)).filter((r) => r.isActive && r.isVerified).map(enrich);
      const stale = await prisma.user.findMany({
        where: {
          id: { in: rows.map((r) => r.id) },
          OR: [{ lastEditedAt: { lt: new Date(Date.now() - staleDays * MS_DAY) } }, { lastEditedAt: null }],
        },
        select: { id: true, lastEditedAt: true, profileViews: true },
      });
      const staleById = new Map(stale.map((s) => [s.id, s]));
      const conVistasSinContactos = rows.filter((r) => r.vistas >= minViews && r.contactos.total === 0).sort((a, b) => b.vistas - a.vistas);
      const sinVistas = rows.filter((r) => r.vistas === 0).sort((a, b) => b.impresiones - a.impresiones);
      const sinActualizar = rows
        .filter((r) => staleById.has(r.id))
        .map((r) => ({ ...r, ultimaActualizacion: staleById.get(r.id)!.lastEditedAt, vistasHistoricas: staleById.get(r.id)!.profileViews }))
        .sort((a, b) => b.vistas - a.vistas);
      const brief = (r: Enriched) => ({ username: r.username, nombre: r.nombre, ciudad: r.ciudad, tier: r.tier, vistas: r.vistas, visitantes: r.visitantes, contactos: r.contactos.total, impresiones: r.impresiones });
      return jsonResult({
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        conVistasSinContactos: { total: conVistasSinContactos.length, criterio: `≥ ${minViews} vistas y 0 contactos en el periodo`, anuncios: conVistasSinContactos.slice(0, take).map(brief) },
        sinVistas: { total: sinVistas.length, criterio: "0 vistas en el periodo (ordenados por impresiones: aparecen pero nadie entra)", anuncios: sinVistas.slice(0, take).map(brief) },
        sinActualizar: { total: sinActualizar.length, criterio: `sin editar la ficha hace más de ${staleDays} días`, anuncios: sinActualizar.slice(0, take).map((r) => ({ ...brief(r), ultimaActualizacion: r.ultimaActualizacion })) },
      });
    }),
  );
}
