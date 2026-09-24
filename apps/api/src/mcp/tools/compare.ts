import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { guarded, type McpContext } from "../audit";
import { describePeriod, errorResult, findUserRef, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { TZ } from "../helpers";
import {
  METRIC_LABELS,
  compareSets,
  describeFiltros,
  filtrosShape,
  metricSet,
  pickFiltros,
  withSegment,
  yearAgo,
  type Filtros,
} from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const MS_DAY = 24 * 60 * 60 * 1000;

const DIMENSIONES = ["ciudad", "region", "comuna", "categoria", "tier", "perfil"] as const;

function dimFilter(dim: (typeof DIMENSIONES)[number], value: string, base: Filtros): Filtros {
  if (dim === "tier") return { ...base, tier: value.toUpperCase() as Filtros["tier"] };
  if (dim === "perfil") return base; // se resuelve aparte
  return { ...base, [dim]: value };
}

/** Métricas de un solo perfil (vistas, visitantes, contactos, mensajes, favoritos). */
async function profileMetrics(userId: string, range: { from: Date; to: Date }) {
  const rows = await prisma.$queryRaw<Record<string, number>[]>`
    SELECT
      (SELECT COUNT(*) FROM "PageView" pv WHERE pv."path" LIKE '/profesional/%' AND split_part(pv."path", '/', 3) = ${userId}
        AND pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to} AND pv."path" NOT LIKE '/admin%'
        AND (pv."userAgent" IS NULL OR pv."userAgent" !~* 'bot|crawl|spider|headless|lighthouse'))::int AS "vistasFichas",
      (SELECT COUNT(DISTINCT COALESCE(pv."visitorId", pv."sessionId", pv."id"::text)) FROM "PageView" pv
        WHERE pv."path" LIKE '/profesional/%' AND split_part(pv."path", '/', 3) = ${userId}
        AND pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to})::int AS "visitantesFichas",
      (SELECT COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD')))
        FROM "UserAction" ua WHERE ua."action" = 'whatsapp_click' AND ua."targetId" = ${userId}::uuid
        AND ua."createdAt" >= ${range.from} AND ua."createdAt" < ${range.to})::int AS "contactosWhatsapp",
      (SELECT COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD')))
        FROM "UserAction" ua WHERE ua."action" = 'phone_click' AND ua."targetId" = ${userId}::uuid
        AND ua."createdAt" >= ${range.from} AND ua."createdAt" < ${range.to})::int AS "contactosTelefono",
      (SELECT COUNT(*) FROM "Message" m WHERE m."toId" = ${userId}::uuid AND m."createdAt" >= ${range.from} AND m."createdAt" < ${range.to})::int AS "mensajesRecibidos",
      (SELECT COUNT(*) FROM "Favorite" f WHERE f."professionalId" = ${userId}::uuid AND f."createdAt" >= ${range.from} AND f."createdAt" < ${range.to})::int AS favoritos,
      (SELECT COALESCE(SUM(impressions), 0) FROM "ProfileDailyStats" d WHERE d."profileId" = ${userId}::uuid
        AND d."date" >= (${range.from}::timestamptz AT TIME ZONE ${TZ})::date AND d."date" < (${range.to}::timestamptz AT TIME ZONE ${TZ})::date + 1)::int AS impresiones`;
  const r: Record<string, number> = {};
  for (const [k, v] of Object.entries(rows[0] ?? {})) r[k] = Number(v) || 0;
  r.tasaContactoPct = r.visitantesFichas ? Math.round(((r.contactosWhatsapp + r.contactosTelefono) / r.visitantesFichas) * 1000) / 10 : 0;
  r.ctrListadoPct = r.impresiones ? Math.round((r.vistasFichas / r.impresiones) * 1000) / 10 : 0;
  return r;
}

/** Promedio por perfil publicado de la ciudad y tier de un perfil. */
async function peerAverage(userId: string, range: { from: Date; to: Date }) {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { city: true, tier: true, profileType: true } });
  if (!me) return null;
  const peersWhere = Prisma.sql`u."profileType"::text = ${me.profileType} AND u."isActive" AND u."isVerified"
    AND u."email" NOT LIKE '%@testseed.uzeed.cl' AND u."role" = 'USER'
    ${me.city ? Prisma.sql`AND lower(u."city") = lower(${me.city})` : Prisma.empty}
    ${me.tier ? Prisma.sql`AND u."tier"::text = ${me.tier}` : Prisma.sql`AND u."tier" IS NULL`}`;
  const rows = await prisma.$queryRaw<{ n: number; vistas: number; visitantes: number; wa: number; tel: number; msgs: number; favs: number }[]>`
    WITH peers AS (SELECT u."id", u."username" FROM "User" u WHERE ${peersWhere})
    SELECT (SELECT COUNT(*) FROM peers)::int AS n,
      (SELECT COUNT(*) FROM "PageView" pv JOIN peers p ON split_part(pv."path", '/', 3) IN (p."id"::text, p."username")
        WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to})::int AS vistas,
      (SELECT COUNT(DISTINCT (COALESCE(pv."visitorId", pv."sessionId", pv."id"::text) || split_part(pv."path", '/', 3))) FROM "PageView" pv
        JOIN peers p ON split_part(pv."path", '/', 3) IN (p."id"::text, p."username")
        WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${range.from} AND pv."createdAt" < ${range.to})::int AS visitantes,
      (SELECT COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || ua."targetId"::text || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD')))
        FROM "UserAction" ua JOIN peers p ON p."id" = ua."targetId" WHERE ua."action" = 'whatsapp_click'
        AND ua."createdAt" >= ${range.from} AND ua."createdAt" < ${range.to})::int AS wa,
      (SELECT COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || ua."targetId"::text || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD')))
        FROM "UserAction" ua JOIN peers p ON p."id" = ua."targetId" WHERE ua."action" = 'phone_click'
        AND ua."createdAt" >= ${range.from} AND ua."createdAt" < ${range.to})::int AS tel,
      (SELECT COUNT(*) FROM "Message" m JOIN peers p ON p."id" = m."toId" WHERE m."createdAt" >= ${range.from} AND m."createdAt" < ${range.to})::int AS msgs,
      (SELECT COUNT(*) FROM "Favorite" f JOIN peers p ON p."id" = f."professionalId" WHERE f."createdAt" >= ${range.from} AND f."createdAt" < ${range.to})::int AS favs`;
  const r = rows[0];
  const n = Number(r?.n) || 0;
  const avg = (v: number) => (n ? Math.round((Number(v) / n) * 100) / 100 : 0);
  return {
    grupo: { ciudad: me.city, tier: me.tier ?? "NINGUNO", tipoPerfil: me.profileType, perfiles: n },
    promedioPorPerfil: {
      vistasFichas: avg(r.vistas),
      visitantesFichas: avg(r.visitantes),
      contactosWhatsapp: avg(r.wa),
      contactosTelefono: avg(r.tel),
      mensajesRecibidos: avg(r.msgs),
      favoritos: avg(r.favs),
      tasaContactoPct: Number(r.visitantes) ? Math.round(((Number(r.wa) + Number(r.tel)) / Number(r.visitantes)) * 1000) / 10 : 0,
    },
  };
}

function ratio(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, { perfil: number; promedio: number; vsPromedioPct: number | null }> = {};
  for (const k of Object.keys(b)) {
    const mine = a[k] ?? 0;
    const avg = b[k] ?? 0;
    out[k] = { perfil: mine, promedio: avg, vsPromedioPct: avg ? Math.round(((mine - avg) / avg) * 1000) / 10 : null };
  }
  return out;
}

export function registerCompareTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "comparar",
    {
      title: "Comparaciones",
      description:
        "Compara métricas (visitas, visitantes, sesiones, vistas y visitantes de fichas, contactos WhatsApp/teléfono, mensajes, favoritos, registros orgánicos, ingresos, búsquedas, tasa de contacto) en cuatro tipos: " +
        "periodos (contra el periodo anterior y contra el mismo periodo del año anterior, con delta absoluto y %); " +
        "entidades (2 o más ciudades, regiones, comunas, categorías, tiers o perfiles lado a lado); " +
        "perfil_vs_promedio (un perfil contra el promedio de los publicados de su ciudad y tier); " +
        "antes_despues (antes y después de una anotación del timeline —campaña, deploy, caída— o de una fecha). Acepta todos los filtros comunes.",
      inputSchema: {
        tipo: z.enum(["periodos", "entidades", "perfil_vs_promedio", "antes_despues"]).describe("Qué comparar."),
        dimension: z.enum(DIMENSIONES).optional().describe("Sólo para entidades."),
        valores: z.array(z.string()).min(2).max(8).optional().describe("Entidades a comparar (ej. [\"Santiago\",\"Viña del Mar\"] o usernames si dimension=perfil)."),
        perfil: z.string().optional().describe("id, username o email (perfil_vs_promedio)."),
        evento: z.string().optional().describe("antes_despues: id o título de una anotación, o una fecha YYYY-MM-DD."),
        ventanaDias: z.number().int().min(1).max(90).optional().describe("antes_despues: días a cada lado (por defecto 7)."),
        ...periodShape,
        ...filtrosShape,
      },
      annotations: READ,
    },
    guarded("comparar", ctx, async (args: PeriodInput & Filtros & { tipo: string; dimension?: (typeof DIMENSIONES)[number]; valores?: string[]; perfil?: string; evento?: string; ventanaDias?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);

      if (args.tipo === "periodos") {
        const ya = yearAgo(period);
        const [cur, prev, last] = await Promise.all([metricSet(period, f), metricSet(period.previous, f), metricSet(ya, f)]);
        return jsonResult({
          periodo: describePeriod(period),
          filtros: describeFiltros(f),
          etiquetas: METRIC_LABELS,
          vsPeriodoAnterior: { rango: period.previous.label, comparacion: compareSets(cur, prev) },
          vsAnioAnterior: { desdeUtc: ya.from.toISOString(), hastaUtc: ya.to.toISOString(), comparacion: compareSets(cur, last) },
          grafico: "barras agrupadas (actual / anterior / año anterior) por métrica",
        });
      }

      if (args.tipo === "entidades") {
        if (!args.dimension || !args.valores?.length) return errorResult("Indica dimension y al menos dos valores.");
        const columnas: Record<string, Record<string, number>> = {};
        for (const value of args.valores) {
          if (args.dimension === "perfil") {
            const id = await findUserRef(value);
            if (!id) return errorResult(`No encontré el perfil "${value}".`);
            columnas[value] = await profileMetrics(id, period);
          } else {
            columnas[value] = await metricSet(period, dimFilter(args.dimension, value, f));
          }
        }
        const metricas = Object.keys(Object.values(columnas)[0] ?? {});
        const tabla = metricas.map((m) => ({
          metrica: m,
          etiqueta: METRIC_LABELS[m] ?? m,
          ...Object.fromEntries(args.valores!.map((v) => [v, columnas[v][m] ?? 0])),
        }));
        return jsonResult({
          periodo: describePeriod(period),
          dimension: args.dimension,
          filtros: describeFiltros(f),
          tabla,
          grafico: "barras agrupadas por métrica, una serie por entidad",
        });
      }

      if (args.tipo === "perfil_vs_promedio") {
        if (!args.perfil) return errorResult("Indica el perfil.");
        const id = await findUserRef(args.perfil);
        if (!id) return errorResult(`No encontré el perfil "${args.perfil}".`);
        const [mine, peers] = await Promise.all([profileMetrics(id, period), peerAverage(id, period)]);
        if (!peers) return errorResult("Perfil no encontrado.");
        return jsonResult({
          periodo: describePeriod(period),
          perfil: args.perfil,
          grupoComparado: peers.grupo,
          comparacion: ratio(mine, peers.promedioPorPerfil),
          extrasPerfil: { impresiones: mine.impresiones, ctrListadoPct: mine.ctrListadoPct },
          grafico: "barras perfil vs promedio por métrica",
        });
      }

      // antes_despues
      if (!args.evento) return errorResult("Indica el evento (anotación o fecha).");
      let at: Date | null = null;
      let label = args.evento;
      if (/^\d{4}-\d{2}-\d{2}$/.test(args.evento)) {
        at = new Date(`${args.evento}T12:00:00Z`);
      } else {
        const ann = await prisma.statsAnnotation.findFirst({
          where: /^[0-9a-f-]{36}$/i.test(args.evento) ? { id: args.evento } : { title: { contains: args.evento, mode: "insensitive" } },
          orderBy: { date: "desc" },
        });
        if (!ann) return errorResult(`No encontré la anotación "${args.evento}". Usa anotaciones para listarlas.`);
        at = ann.date;
        label = `${ann.title} (${ann.kind}, ${ann.date.toISOString().slice(0, 10)})`;
      }
      const days = args.ventanaDias ?? 7;
      const before = { from: new Date(at.getTime() - days * MS_DAY), to: at };
      const after = { from: at, to: new Date(Math.min(at.getTime() + days * MS_DAY, Date.now())) };
      const [b, a] = await Promise.all([metricSet(before, f), metricSet(after, f)]);
      return jsonResult({
        evento: label,
        ventana: { dias: days, antes: { desdeUtc: before.from.toISOString(), hastaUtc: before.to.toISOString() }, despues: { desdeUtc: after.from.toISOString(), hastaUtc: after.to.toISOString() } },
        filtros: describeFiltros(f),
        etiquetas: METRIC_LABELS,
        // "actual" = después, "anterior" = antes.
        comparacion: compareSets(a, b),
        nota: after.to.getTime() - after.from.getTime() < days * MS_DAY ? "La ventana 'después' aún no se completa." : undefined,
        grafico: "línea temporal con marca vertical en el evento",
      });
    }),
  );

  server.registerTool(
    "tarjetas_kpi",
    {
      title: "Tarjetas KPI",
      description:
        "Las tarjetas del panel: cada KPI con su valor en el periodo, delta absoluto y % contra el periodo anterior, y un mini-sparkline diario (últimos 14 días). Acepta filtros comunes.",
      inputSchema: { ...periodShape, ...filtrosShape },
      annotations: READ,
    },
    guarded("tarjetas_kpi", ctx, async (args: PeriodInput & Filtros) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const [cur, prev] = await Promise.all([metricSet(period, f), metricSet(period.previous, f)]);
      const cmp = compareSets(cur, prev);
      // Sparkline: 14 días diarios terminando en el fin del periodo.
      const end = period.to;
      const days: { from: Date; to: Date }[] = [];
      for (let i = 13; i >= 0; i--) days.push({ from: new Date(end.getTime() - (i + 1) * MS_DAY), to: new Date(end.getTime() - i * MS_DAY) });
      const series = await Promise.all(days.map((d) => metricSet(d, f)));
      const tarjetas = Object.keys(cur).map((k) => ({
        metrica: k,
        etiqueta: METRIC_LABELS[k] ?? k,
        valor: cur[k],
        deltaAbsoluto: cmp[k].diferencia,
        deltaPct: cmp[k].variacionPct,
        baseChica: cmp[k].baseChica,
        sparkline: series.map((s) => s[k] ?? 0),
      }));
      return jsonResult({ periodo: describePeriod(period), filtros: describeFiltros(f), tarjetas, grafico: "tarjetas con sparkline" });
    }),
  );
}
