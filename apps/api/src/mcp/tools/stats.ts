import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { buildAdminOverview } from "../../admin/overview";
import { guarded, type McpScope } from "../audit";
import {
  PROFILE_TYPES,
  TZ,
  deltaPct,
  describePeriod,
  jsonResult,
  periodShape,
  resolvePeriod,
  type PeriodInput,
} from "../helpers";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

type Range = { from: Date; to: Date };

async function uniqueSessions({ from, to }: Range): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: number }[]>`
    SELECT COUNT(DISTINCT "sessionId")::int AS n
    FROM "PageView"
    WHERE "createdAt" >= ${from} AND "createdAt" < ${to} AND "sessionId" IS NOT NULL`;
  return rows[0]?.n ?? 0;
}

/** Los indicadores principales de un rango. Se calcula dos veces para comparar. */
async function computeKpis(range: Range) {
  const created = { gte: range.from, lt: range.to };
  const [
    newUsersByType,
    paidIntents,
    paidByPurpose,
    depositsApproved,
    withdrawalsApproved,
    messages,
    serviceRequests,
    serviceRequestsCompleted,
    videocalls,
    favorites,
    pageViews,
    sessions,
    whatsappClicks,
    phoneClicks,
    marketOrdersPaid,
    umateDirectSubs,
    forumPosts,
    stories,
    verifiedProfiles,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["profileType"], where: { createdAt: created }, _count: { _all: true } }),
    prisma.paymentIntent.aggregate({
      where: { status: "PAID", paidAt: created },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.paymentIntent.groupBy({
      by: ["purpose"],
      where: { status: "PAID", paidAt: created },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.tokenDeposit.aggregate({
      where: { status: "APPROVED", reviewedAt: created },
      _sum: { clpAmount: true },
      _count: { _all: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { status: "APPROVED", reviewedAt: created },
      _sum: { clpAmount: true },
      _count: { _all: true },
    }),
    prisma.message.count({ where: { createdAt: created } }),
    prisma.serviceRequest.count({ where: { createdAt: created } }),
    prisma.serviceRequest.count({ where: { status: "FINALIZADO", updatedAt: created } }),
    prisma.videocallBooking.count({ where: { createdAt: created } }),
    prisma.favorite.count({ where: { createdAt: created } }),
    prisma.pageView.count({ where: { createdAt: created } }),
    uniqueSessions(range),
    prisma.userAction.count({ where: { action: "whatsapp_click", createdAt: created } }),
    prisma.userAction.count({ where: { action: "phone_click", createdAt: created } }),
    prisma.marketOrder.aggregate({
      where: { paidAt: created },
      _sum: { totalClp: true, commissionClp: true },
      _count: { _all: true },
    }),
    prisma.umateDirectSubscription.count({ where: { createdAt: created } }),
    prisma.forumPost.count({ where: { createdAt: created } }),
    prisma.story.count({ where: { createdAt: created } }),
    prisma.user.count({ where: { verifiedAt: created } }),
  ]);

  const newUsers: Record<string, number> = {};
  let newUsersTotal = 0;
  for (const row of newUsersByType) {
    newUsers[row.profileType] = row._count._all;
    newUsersTotal += row._count._all;
  }

  const paymentsClp = paidIntents._sum.amount || 0;
  const transferDepositsClp = depositsApproved._sum.clpAmount || 0;

  return {
    usuariosNuevos: newUsersTotal,
    usuariosNuevosPorTipo: newUsers,
    perfilesVerificados: verifiedProfiles,
    ingresosPagosClp: paymentsClp,
    pagosAprobados: paidIntents._count._all,
    ingresosPorProposito: Object.fromEntries(
      paidByPurpose.map((r) => [r.purpose, { clp: r._sum.amount || 0, pagos: r._count._all }]),
    ),
    depositosTokensAprobadosClp: transferDepositsClp,
    depositosTokensAprobados: depositsApproved._count._all,
    retirosAprobadosClp: withdrawalsApproved._sum.clpAmount || 0,
    retirosAprobados: withdrawalsApproved._count._all,
    mensajes: messages,
    solicitudesServicio: serviceRequests,
    solicitudesFinalizadas: serviceRequestsCompleted,
    videollamadasReservadas: videocalls,
    favoritos: favorites,
    visitas: pageViews,
    sesionesUnicas: sessions,
    clicksWhatsapp: whatsappClicks,
    clicksTelefono: phoneClicks,
    marketplacePedidosPagados: marketOrdersPaid._count._all,
    marketplaceVentasClp: marketOrdersPaid._sum.totalClp || 0,
    marketplaceComisionClp: marketOrdersPaid._sum.commissionClp || 0,
    umateSuscripcionesNuevas: umateDirectSubs,
    postsForo: forumPosts,
    historias: stories,
  };
}

type Kpis = Awaited<ReturnType<typeof computeKpis>>;

function compareKpis(current: Kpis, previous: Kpis) {
  const out: Record<string, { actual: number; anterior: number; variacionPct: number | null }> = {};
  for (const [key, value] of Object.entries(current)) {
    if (typeof value !== "number") continue;
    const prev = (previous as Record<string, unknown>)[key];
    const prevNum = typeof prev === "number" ? prev : 0;
    out[key] = { actual: value, anterior: prevNum, variacionPct: deltaPct(value, prevNum) };
  }
  return out;
}

/**
 * Métricas disponibles para series temporales. Las tablas y columnas salen de
 * este mapa fijo (nunca del input), así que se pueden interpolar crudas.
 */
const SERIES: Record<
  string,
  { table: string; dateCol: string; agg: string; where?: string; description: string; profileFilter?: boolean }
> = {
  usuarios_nuevos: { table: "User", dateCol: "createdAt", agg: "COUNT(*)", description: "Registros nuevos", profileFilter: true },
  perfiles_verificados: { table: "User", dateCol: "verifiedAt", agg: "COUNT(*)", description: "Perfiles verificados", profileFilter: true },
  ingresos_clp: { table: "PaymentIntent", dateCol: "paidAt", agg: `SUM("amount")`, where: `"status" = 'PAID'`, description: "CLP cobrados (pagos aprobados)" },
  pagos: { table: "PaymentIntent", dateCol: "paidAt", agg: "COUNT(*)", where: `"status" = 'PAID'`, description: "Pagos aprobados" },
  depositos_tokens_clp: { table: "TokenDeposit", dateCol: "reviewedAt", agg: `SUM("clpAmount")`, where: `"status" = 'APPROVED'`, description: "CLP de depósitos de tokens aprobados" },
  retiros_clp: { table: "WithdrawalRequest", dateCol: "reviewedAt", agg: `SUM("clpAmount")`, where: `"status" = 'APPROVED'`, description: "CLP de retiros aprobados" },
  mensajes: { table: "Message", dateCol: "createdAt", agg: "COUNT(*)", description: "Mensajes enviados" },
  visitas: { table: "PageView", dateCol: "createdAt", agg: "COUNT(*)", description: "Páginas vistas" },
  sesiones_unicas: { table: "PageView", dateCol: "createdAt", agg: `COUNT(DISTINCT "sessionId")`, description: "Sesiones únicas" },
  visitas_perfiles: { table: "PageView", dateCol: "createdAt", agg: "COUNT(*)", where: `"path" LIKE '/profesional/%'`, description: "Visitas a fichas de profesionales" },
  clicks_whatsapp: { table: "UserAction", dateCol: "createdAt", agg: "COUNT(*)", where: `"action" = 'whatsapp_click'`, description: "Clicks a WhatsApp" },
  favoritos: { table: "Favorite", dateCol: "createdAt", agg: "COUNT(*)", description: "Favoritos agregados" },
  solicitudes_servicio: { table: "ServiceRequest", dateCol: "createdAt", agg: "COUNT(*)", description: "Solicitudes de servicio" },
  videollamadas: { table: "VideocallBooking", dateCol: "createdAt", agg: "COUNT(*)", description: "Videollamadas reservadas" },
  marketplace_pedidos: { table: "MarketOrder", dateCol: "paidAt", agg: "COUNT(*)", description: "Pedidos pagados del marketplace" },
  marketplace_ventas_clp: { table: "MarketOrder", dateCol: "paidAt", agg: `SUM("totalClp")`, description: "CLP vendidos en el marketplace" },
  marketplace_comision_clp: { table: "MarketOrder", dateCol: "paidAt", agg: `SUM("commissionClp")`, description: "Comisión del marketplace" },
  umate_suscripciones: { table: "UmateDirectSubscription", dateCol: "createdAt", agg: "COUNT(*)", description: "Suscripciones nuevas U-Mate" },
  historias: { table: "Story", dateCol: "createdAt", agg: "COUNT(*)", description: "Historias publicadas" },
  posts_foro: { table: "ForumPost", dateCol: "createdAt", agg: "COUNT(*)", description: "Posts del foro" },
};

const SERIES_KEYS = Object.keys(SERIES) as [string, ...string[]];

const BUCKETS = { dia: "day", semana: "week", mes: "month" } as const;

export function registerStatsTools(server: McpServer, scope: McpScope) {
  server.registerTool(
    "resumen_general",
    {
      title: "Resumen general de UZEED",
      description:
        "Foto actual del negocio (la misma del panel admin): usuarios por tipo, altas de hoy/semana/mes, activos, ingresos de hoy/semana/mes, pendientes operativos, engagement de la semana, top ciudades y top profesionales por vistas y ganancias. Úsala como punto de partida de cualquier informe.",
      inputSchema: {},
      annotations: READ,
    },
    guarded("resumen_general", scope, async () => jsonResult(await buildAdminOverview())),
  );

  server.registerTool(
    "kpis_periodo",
    {
      title: "KPIs de un periodo",
      description:
        "Indicadores clave de un rango de fechas (registros por tipo, ingresos por propósito, depósitos y retiros de tokens, mensajes, solicitudes, videollamadas, favoritos, visitas, sesiones únicas, clicks a WhatsApp, marketplace, U-Mate, foro, historias) comparados contra el periodo anterior del mismo largo, con variación %.",
      inputSchema: {
        ...periodShape,
        comparar: z.boolean().optional().describe("Comparar contra el periodo anterior (por defecto true)."),
      },
      annotations: READ,
    },
    guarded("kpis_periodo", scope, async (args: PeriodInput & { comparar?: boolean }) => {
      const period = resolvePeriod(args);
      const current = await computeKpis(period);
      if (args.comparar === false) {
        return jsonResult({ periodo: describePeriod(period), kpis: current });
      }
      const previous = await computeKpis(period.previous);
      return jsonResult({
        periodo: describePeriod(period),
        periodoAnterior: { desdeUtc: period.previous.from.toISOString(), hastaUtc: period.previous.to.toISOString() },
        kpis: current,
        comparacion: compareKpis(current, previous),
      });
    }),
  );

  server.registerTool(
    "serie_temporal",
    {
      title: "Serie temporal de una métrica",
      description:
        "Evolución de una métrica por día, semana o mes (hora de Chile), lista para graficar o detectar tendencias. Métricas: " +
        Object.entries(SERIES)
          .map(([k, v]) => `${k} (${v.description})`)
          .join(", ") +
        ".",
      inputSchema: {
        metrica: z.enum(SERIES_KEYS),
        agrupacion: z.enum(["dia", "semana", "mes"]).optional().describe("Por defecto: dia."),
        tipoPerfil: z.enum(PROFILE_TYPES).optional().describe("Sólo para usuarios_nuevos / perfiles_verificados."),
        ...periodShape,
      },
      annotations: READ,
    },
    guarded(
      "serie_temporal",
      scope,
      async (args: PeriodInput & { metrica: string; agrupacion?: keyof typeof BUCKETS; tipoPerfil?: string }) => {
        const def = SERIES[args.metrica];
        const period = resolvePeriod(args);
        const bucket = BUCKETS[args.agrupacion || "dia"];
        const col = `"${def.dateCol}"`;
        const localTs = `((${col} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`;
        const conditions: Prisma.Sql[] = [
          Prisma.sql`${Prisma.raw(col)} >= ${period.from}`,
          Prisma.sql`${Prisma.raw(col)} < ${period.to}`,
        ];
        if (def.where) conditions.push(Prisma.raw(def.where));
        if (def.profileFilter && args.tipoPerfil) {
          conditions.push(Prisma.sql`"profileType"::text = ${args.tipoPerfil}`);
        }
        const rows = await prisma.$queryRaw<{ periodo: string; valor: number | null }[]>`
          SELECT to_char(date_trunc(${bucket}, ${Prisma.raw(localTs)}), 'YYYY-MM-DD') AS periodo,
                 COALESCE(${Prisma.raw(def.agg)}, 0)::float8 AS valor
          FROM ${Prisma.raw(`"${def.table}"`)}
          WHERE ${Prisma.join(conditions, " AND ")}
          GROUP BY 1
          ORDER BY 1`;
        const total = rows.reduce((acc, r) => acc + (r.valor || 0), 0);
        return jsonResult({
          metrica: args.metrica,
          descripcion: def.description,
          agrupacion: args.agrupacion || "dia",
          periodo: describePeriod(period),
          total,
          puntos: rows.map((r) => ({ periodo: r.periodo, valor: r.valor || 0 })),
          nota: "Los periodos sin actividad no aparecen (valen 0).",
        });
      },
    ),
  );

  server.registerTool(
    "analitica_trafico",
    {
      title: "Analítica de tráfico web",
      description:
        "Tráfico del sitio en un periodo: páginas vistas, sesiones únicas, % con sesión iniciada, páginas más vistas, secciones, referentes (dominios), ciudades, países y acciones registradas (clicks a WhatsApp, teléfono, compartir...).",
      inputSchema: {
        ...periodShape,
        limite: z.number().int().min(1).max(100).optional().describe("Filas por ranking (por defecto 20)."),
      },
      annotations: READ,
    },
    guarded("analitica_trafico", scope, async (args: PeriodInput & { limite?: number }) => {
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const range = { gte: period.from, lt: period.to };
      const [views, loggedIn, sessions, topPaths, sections, referrers, cities, countries, actions] = await Promise.all([
        prisma.pageView.count({ where: { createdAt: range } }),
        prisma.pageView.count({ where: { createdAt: range, userId: { not: null } } }),
        uniqueSessions(period),
        prisma.pageView.groupBy({
          by: ["path"],
          where: { createdAt: range },
          _count: { _all: true },
          orderBy: { _count: { path: "desc" } },
          take,
        }),
        prisma.$queryRaw<{ seccion: string; visitas: number }[]>`
          SELECT COALESCE(NULLIF(split_part("path", '/', 2), ''), '(inicio)') AS seccion, COUNT(*)::int AS visitas
          FROM "PageView" WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.$queryRaw<{ referente: string; visitas: number }[]>`
          SELECT COALESCE(substring("referrer" from '^(?:https?://)?(?:www[.])?([^/:?#]+)'), '(directo)') AS referente,
                 COUNT(*)::int AS visitas
          FROM "PageView" WHERE "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.pageView.groupBy({
          by: ["city"],
          where: { createdAt: range, city: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { city: "desc" } },
          take,
        }),
        prisma.pageView.groupBy({
          by: ["country"],
          where: { createdAt: range, country: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { country: "desc" } },
          take,
        }),
        prisma.userAction.groupBy({
          by: ["action"],
          where: { createdAt: range },
          _count: { _all: true },
          orderBy: { _count: { action: "desc" } },
        }),
      ]);
      return jsonResult({
        periodo: describePeriod(period),
        visitas: views,
        sesionesUnicas: sessions,
        visitasPorSesion: sessions ? Math.round((views / sessions) * 10) / 10 : null,
        pctConSesionIniciada: views ? Math.round((loggedIn / views) * 1000) / 10 : null,
        paginasMasVistas: topPaths.map((r) => ({ ruta: r.path, visitas: r._count._all })),
        secciones: sections,
        referentes: referrers,
        ciudades: cities.map((r) => ({ ciudad: r.city, visitas: r._count._all })),
        paises: countries.map((r) => ({ pais: r.country, visitas: r._count._all })),
        acciones: actions.map((r) => ({ accion: r.action, total: r._count._all })),
      });
    }),
  );
}
