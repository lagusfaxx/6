import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { buildAdminOverview } from "../../admin/overview";
import {
  actorKeySql,
  organicSignupWhere,
  realActionSql,
  realPageViewSql,
  realUserSql,
  realUserWhere,
  staffIdsSql,
  visitorKeySql,
} from "../../lib/statsFilters";
import { guarded, type McpScope } from "../audit";
import {
  PROFILE_TYPES,
  TZ,
  compare,
  describePeriod,
  jsonResult,
  periodShape,
  resolvePeriod,
  type PeriodInput,
} from "../helpers";
import { clickSummary, localTs, messagingSummary, trafficSummary, type Range } from "../metrics";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

/** Pedidos del marketplace que se pagaron y no se deshicieron después. */
const MARKET_SALE_STATUSES = ["PAID", "PREPARING", "DELIVERED", "COMPLETED", "DISPUTED"] as const;

const CRITERIOS = {
  usuarios: "Sin perfiles de prueba (@testseed.uzeed.cl) ni cuentas del equipo. 'Registros orgánicos' excluye además los perfiles que carga el admin.",
  trafico: "Sin bots/herramientas (user agent), sin el equipo y sin páginas /admin. Visitantes únicos por navegador (visitorId).",
  clicks: "Sin clicks del equipo. 'contactosUnicos' cuenta una vez por persona, perfil y día (doble click o botón de arriba + el fijo cuentan 1).",
  ingresos: "Pagos aprobados por fecha de pago + depósitos de tokens por transferencia aprobados. Los depósitos por Flow ya están dentro de los pagos (no se suman dos veces).",
  marketplace: "Ventas de pedidos pagados que no terminaron reembolsados, cancelados ni rechazados.",
  comparacion: "Contra el periodo anterior del mismo largo; si el periodo está en curso, hasta la misma hora. 'baseChica' marca variaciones con menos de 20 casos.",
};

/** Los indicadores principales de un rango. Se calcula dos veces para comparar. */
async function computeKpis(range: Range) {
  const created = { gte: range.from, lt: range.to };
  const real = realUserWhere();
  const [
    signupsByType,
    organicByType,
    adminLoaded,
    verifiedProfiles,
    paidIntents,
    paidByPurpose,
    transferDeposits,
    withdrawalsApproved,
    messaging,
    serviceRequests,
    serviceRequestsCompleted,
    videocalls,
    favorites,
    traffic,
    whatsapp,
    phone,
    marketSales,
    umateDirectSubs,
    forumPosts,
    stories,
  ] = await Promise.all([
    prisma.user.groupBy({ by: ["profileType"], where: { AND: [real, { createdAt: created }] }, _count: { _all: true } }),
    prisma.user.groupBy({
      by: ["profileType"],
      where: { AND: [organicSignupWhere(), { createdAt: created }] },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { AND: [real, { adminManaged: true, createdAt: created }] } }),
    prisma.user.count({ where: { AND: [real, { verifiedAt: created }] } }),
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
      where: { status: "APPROVED", method: "TRANSFER", reviewedAt: created },
      _sum: { clpAmount: true },
      _count: { _all: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { status: "APPROVED", reviewedAt: created },
      _sum: { clpAmount: true },
      _count: { _all: true },
    }),
    messagingSummary(range),
    prisma.serviceRequest.count({ where: { createdAt: created, client: real, professional: real } }),
    prisma.serviceRequest.count({ where: { status: "FINALIZADO", updatedAt: created, professional: real } }),
    prisma.videocallBooking.count({ where: { createdAt: created, client: real, professional: real } }),
    prisma.favorite.count({ where: { createdAt: created, user: real } }),
    trafficSummary(range),
    clickSummary("whatsapp_click", range),
    clickSummary("phone_click", range),
    prisma.marketOrder.aggregate({
      where: { paidAt: created, status: { in: [...MARKET_SALE_STATUSES] } },
      _sum: { totalClp: true, commissionClp: true },
      _count: { _all: true },
    }),
    prisma.umateDirectSubscription.count({ where: { createdAt: created } }),
    prisma.forumPost.count({ where: { createdAt: created } }),
    prisma.story.count({ where: { createdAt: created } }),
  ]);

  const byType = (rows: { profileType: string; _count: { _all: number } }[]) =>
    Object.fromEntries(rows.map((r) => [r.profileType, r._count._all]));
  const sum = (rows: { _count: { _all: number } }[]) => rows.reduce((acc, r) => acc + r._count._all, 0);

  const paymentsClp = paidIntents._sum.amount || 0;
  const transferClp = transferDeposits._sum.clpAmount || 0;
  const paymentsCount = paidIntents._count._all + transferDeposits._count._all;

  return {
    usuarios: {
      registros: sum(signupsByType),
      registrosOrganicos: sum(organicByType),
      registrosOrganicosPorTipo: byType(organicByType),
      perfilesCargadosPorAdmin: adminLoaded,
      perfilesVerificados: verifiedProfiles,
    },
    ingresos: {
      cobradoClp: paymentsClp + transferClp,
      pagos: paymentsCount,
      ticketPromedioClp: paymentsCount ? Math.round((paymentsClp + transferClp) / paymentsCount) : 0,
      porProposito: Object.fromEntries(
        paidByPurpose.map((r) => [r.purpose, { clp: r._sum.amount || 0, pagos: r._count._all }]),
      ),
      depositosTokensTransferenciaClp: transferClp,
      retirosAprobadosClp: withdrawalsApproved._sum.clpAmount || 0,
      retirosAprobados: withdrawalsApproved._count._all,
    },
    trafico: traffic,
    contactos: {
      whatsapp: whatsapp,
      telefono: phone,
    },
    mensajeria: messaging,
    servicios: {
      solicitudes: serviceRequests,
      // No hay fecha de cierre: se usa la última actualización de la solicitud.
      solicitudesFinalizadasAprox: serviceRequestsCompleted,
      videollamadasReservadas: videocalls,
      favoritos: favorites,
    },
    marketplace: {
      pedidosPagados: marketSales._count._all,
      ventasClp: marketSales._sum.totalClp || 0,
      comisionClp: marketSales._sum.commissionClp || 0,
    },
    contenido: {
      umateSuscripcionesNuevas: umateDirectSubs,
      postsForo: forumPosts,
      historias: stories,
    },
  };
}

type Kpis = Awaited<ReturnType<typeof computeKpis>>;

/** Recorre los números del objeto (con ruta "grupo.metrica") y los compara. */
function compareKpis(current: Kpis, previous: Kpis) {
  const out: Record<string, ReturnType<typeof compare>> = {};
  const walk = (cur: unknown, prev: unknown, path: string) => {
    if (typeof cur === "number") {
      out[path] = compare(cur, typeof prev === "number" ? prev : 0);
      return;
    }
    if (!cur || typeof cur !== "object") return;
    for (const [key, value] of Object.entries(cur as Record<string, unknown>)) {
      if (key === "excluidas" || key.startsWith("pct")) continue;
      walk(value, (prev as Record<string, unknown> | undefined)?.[key], path ? `${path}.${key}` : key);
    }
  };
  walk(current, previous, "");
  return out;
}

/**
 * Métricas para series temporales. Tablas, columnas y filtros salen de este
 * mapa fijo (nunca del input), así que se pueden interpolar crudos. La tabla
 * siempre va con alias "t".
 */
type SeriesDef = {
  table: string;
  dateCol: string;
  agg: () => Prisma.Sql;
  where?: () => Prisma.Sql;
  description: string;
  profileFilter?: boolean;
};

const raw = (sql: string) => () => Prisma.raw(sql);

const SERIES: Record<string, SeriesDef> = {
  registros: {
    table: "User", dateCol: "createdAt", agg: raw("COUNT(*)"), where: () => realUserSql("t"),
    description: "Registros (sin prueba ni equipo)", profileFilter: true,
  },
  registros_organicos: {
    table: "User", dateCol: "createdAt", agg: raw("COUNT(*)"),
    where: () => Prisma.sql`${realUserSql("t")} AND t."adminManaged" = false`,
    description: "Registros orgánicos (sin perfiles cargados por admin)", profileFilter: true,
  },
  perfiles_verificados: {
    table: "User", dateCol: "verifiedAt", agg: raw("COUNT(*)"), where: () => realUserSql("t"),
    description: "Perfiles verificados", profileFilter: true,
  },
  ingresos_clp: {
    table: "PaymentIntent", dateCol: "paidAt", agg: raw(`SUM(t."amount")`), where: raw(`t."status" = 'PAID'`),
    description: "CLP cobrados por pagos aprobados (no incluye depósitos por transferencia: ver depositos_transferencia_clp)",
  },
  pagos: {
    table: "PaymentIntent", dateCol: "paidAt", agg: raw("COUNT(*)"), where: raw(`t."status" = 'PAID'`),
    description: "Pagos aprobados",
  },
  depositos_transferencia_clp: {
    table: "TokenDeposit", dateCol: "reviewedAt", agg: raw(`SUM(t."clpAmount")`),
    where: raw(`t."status" = 'APPROVED' AND t."method" = 'TRANSFER'`),
    description: "CLP de depósitos de tokens por transferencia aprobados",
  },
  retiros_clp: {
    table: "WithdrawalRequest", dateCol: "reviewedAt", agg: raw(`SUM(t."clpAmount")`), where: raw(`t."status" = 'APPROVED'`),
    description: "CLP de retiros aprobados",
  },
  mensajes: {
    table: "Message", dateCol: "createdAt", agg: raw("COUNT(*)"),
    where: () => Prisma.sql`t."fromId" NOT IN ${staffIdsSql()} AND t."toId" NOT IN ${staffIdsSql()}`,
    description: "Mensajes enviados (sin el equipo)",
  },
  visitas: {
    table: "PageView", dateCol: "createdAt", agg: raw("COUNT(*)"), where: () => realPageViewSql("t"),
    description: "Páginas vistas reales",
  },
  visitantes_unicos: {
    table: "PageView", dateCol: "createdAt", agg: () => Prisma.sql`COUNT(DISTINCT ${visitorKeySql("t")})`,
    where: () => realPageViewSql("t"),
    description: "Visitantes únicos (por navegador) de cada día/semana/mes",
  },
  visitas_fichas: {
    table: "PageView", dateCol: "createdAt", agg: raw("COUNT(*)"),
    where: () => Prisma.sql`t."path" LIKE '/profesional/%' AND ${realPageViewSql("t")}`,
    description: "Visitas reales a fichas de profesionales",
  },
  contactos_whatsapp: {
    table: "UserAction", dateCol: "createdAt",
    agg: () => Prisma.sql`COUNT(DISTINCT (${actorKeySql("t")} || ':' || COALESCE(t."targetId"::text, '') || ':' || to_char(${localTs('t."createdAt"')}, 'YYYY-MM-DD')))`,
    where: () => Prisma.sql`t."action" = 'whatsapp_click' AND ${realActionSql("t")}`,
    description: "Contactos únicos por WhatsApp (persona + perfil + día)",
  },
  clicks_whatsapp: {
    table: "UserAction", dateCol: "createdAt", agg: raw("COUNT(*)"),
    where: () => Prisma.sql`t."action" = 'whatsapp_click' AND ${realActionSql("t")}`,
    description: "Clicks a WhatsApp sin deduplicar (sin el equipo)",
  },
  favoritos: { table: "Favorite", dateCol: "createdAt", agg: raw("COUNT(*)"), description: "Favoritos agregados" },
  solicitudes_servicio: { table: "ServiceRequest", dateCol: "createdAt", agg: raw("COUNT(*)"), description: "Solicitudes de servicio" },
  videollamadas: { table: "VideocallBooking", dateCol: "createdAt", agg: raw("COUNT(*)"), description: "Videollamadas reservadas" },
  marketplace_pedidos: {
    table: "MarketOrder", dateCol: "paidAt", agg: raw("COUNT(*)"),
    where: raw(`t."status" IN (${MARKET_SALE_STATUSES.map((s) => `'${s}'`).join(", ")})`),
    description: "Pedidos pagados del marketplace (sin reembolsados ni cancelados)",
  },
  marketplace_ventas_clp: {
    table: "MarketOrder", dateCol: "paidAt", agg: raw(`SUM(t."totalClp")`),
    where: raw(`t."status" IN (${MARKET_SALE_STATUSES.map((s) => `'${s}'`).join(", ")})`),
    description: "CLP vendidos en el marketplace (netos de reembolsos)",
  },
  marketplace_comision_clp: {
    table: "MarketOrder", dateCol: "paidAt", agg: raw(`SUM(t."commissionClp")`),
    where: raw(`t."status" IN (${MARKET_SALE_STATUSES.map((s) => `'${s}'`).join(", ")})`),
    description: "Comisión del marketplace (netos de reembolsos)",
  },
  umate_suscripciones: { table: "UmateDirectSubscription", dateCol: "createdAt", agg: raw("COUNT(*)"), description: "Suscripciones nuevas U-Mate" },
  historias: { table: "Story", dateCol: "createdAt", agg: raw("COUNT(*)"), description: "Historias publicadas" },
  posts_foro: { table: "ForumPost", dateCol: "createdAt", agg: raw("COUNT(*)"), description: "Posts del foro" },
};

const SERIES_KEYS = Object.keys(SERIES) as [string, ...string[]];

const BUCKETS = { dia: "day", semana: "week", mes: "month" } as const;

export function registerStatsTools(server: McpServer, scope: McpScope) {
  server.registerTool(
    "resumen_general",
    {
      title: "Resumen general de UZEED",
      description:
        "Foto actual del negocio (la misma del panel admin): usuarios por tipo, altas de hoy/semana/mes, activos, ingresos de hoy/semana/mes, pendientes operativos, engagement de la semana, top ciudades y top profesionales. Días en hora de Chile, sin perfiles de prueba ni cuentas del equipo. Para números de un periodo con comparación usa kpis_periodo.",
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
        "Indicadores clave de un rango con criterios limpios: registros (totales, orgánicos, por tipo, cargados por admin), ingresos cobrados sin doble conteo, ticket promedio, tráfico real (sin bots ni equipo) con visitantes únicos, contactos únicos por WhatsApp y teléfono, mensajería (conversaciones nuevas y activas), servicios, marketplace neto de reembolsos y contenido. Compara contra el periodo anterior equivalente (hasta la misma hora si está en curso) con diferencia y variación %.",
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
        return jsonResult({ periodo: describePeriod(period), criterios: CRITERIOS, kpis: current });
      }
      const previous = await computeKpis(period.previous);
      return jsonResult({
        periodo: describePeriod(period),
        periodoAnterior: {
          rango: period.previous.label,
          desdeUtc: period.previous.from.toISOString(),
          hastaUtc: period.previous.to.toISOString(),
        },
        criterios: CRITERIOS,
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
        "Evolución de una métrica por día, semana (lunes) o mes en hora de Chile, con los periodos sin actividad en 0, lista para graficar. Métricas: " +
        Object.entries(SERIES)
          .map(([k, v]) => `${k} (${v.description})`)
          .join(", ") +
        ".",
      inputSchema: {
        metrica: z.enum(SERIES_KEYS),
        agrupacion: z.enum(["dia", "semana", "mes"]).optional().describe("Por defecto: dia."),
        tipoPerfil: z.enum(PROFILE_TYPES).optional().describe("Sólo para registros, registros_organicos y perfiles_verificados."),
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
        const unit = BUCKETS[args.agrupacion || "dia"];
        const col = `t."${def.dateCol}"`;
        const conditions: Prisma.Sql[] = [
          Prisma.sql`${Prisma.raw(col)} >= ${period.from}`,
          Prisma.sql`${Prisma.raw(col)} < ${period.to}`,
        ];
        if (def.where) conditions.push(def.where());
        if (def.profileFilter && args.tipoPerfil) {
          conditions.push(Prisma.sql`t."profileType"::text = ${args.tipoPerfil}`);
        }
        const step = Prisma.raw(`'1 ${unit}'::interval`);
        const unitLit = Prisma.raw(`'${unit}'`);
        const rows = await prisma.$queryRaw<{ periodo: string; valor: number }[]>`
          WITH buckets AS (
            SELECT generate_series(
              date_trunc(${unitLit}, ${period.from}::timestamptz AT TIME ZONE ${TZ}),
              date_trunc(${unitLit}, (${period.to}::timestamptz - interval '1 millisecond') AT TIME ZONE ${TZ}),
              ${step}
            ) AS b
          ), data AS (
            SELECT date_trunc(${unitLit}, ${localTs(col)}) AS b, ${def.agg()} AS v
            FROM ${Prisma.raw(`"${def.table}"`)} t
            WHERE ${Prisma.join(conditions, " AND ")}
            GROUP BY 1
          )
          SELECT to_char(buckets.b, 'YYYY-MM-DD') AS periodo, COALESCE(data.v, 0)::float8 AS valor
          FROM buckets LEFT JOIN data ON data.b = buckets.b
          ORDER BY buckets.b`;
        const values = rows.map((r) => r.valor);
        const total = values.reduce((a, b) => a + b, 0);
        const distinctMetric = args.metrica === "visitantes_unicos";
        return jsonResult({
          metrica: args.metrica,
          descripcion: def.description,
          agrupacion: args.agrupacion || "dia",
          periodo: describePeriod(period),
          // Los visitantes únicos no se suman entre días: la misma persona
          // vuelve. El total del periodo está en kpis_periodo.
          total: distinctMetric ? null : total,
          promedioPorPeriodo: rows.length ? Math.round((total / rows.length) * 100) / 100 : 0,
          maximo: rows.length ? rows.reduce((m, r) => (r.valor > m.valor ? r : m)) : null,
          minimo: rows.length ? rows.reduce((m, r) => (r.valor < m.valor ? r : m)) : null,
          nota: period.inProgress ? "El último punto está en curso (incompleto)." : undefined,
          puntos: rows,
        });
      },
    ),
  );

  server.registerTool(
    "analitica_trafico",
    {
      title: "Analítica de tráfico web",
      description:
        "Tráfico real del sitio en un periodo (sin bots, sin el equipo, sin /admin): visitas, visitantes únicos, sesiones, cuánto se excluyó y por qué, páginas y secciones más vistas (con visitantes), fuentes de entrada (referente de la primera página de cada sesión, no de cada página), páginas de entrada, ciudades, países y acciones (brutas y únicas).",
      inputSchema: {
        ...periodShape,
        limite: z.number().int().min(1).max(100).optional().describe("Filas por ranking (por defecto 20)."),
      },
      annotations: READ,
    },
    guarded("analitica_trafico", scope, async (args: PeriodInput & { limite?: number }) => {
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const inRange = Prisma.sql`pv."createdAt" >= ${period.from} AND pv."createdAt" < ${period.to} AND ${realPageViewSql("pv")}`;
      const [summary, topPaths, sections, sources, landings, cities, countries, actions] = await Promise.all([
        trafficSummary(period),
        prisma.$queryRaw<{ ruta: string; visitas: number; visitantes: number }[]>`
          SELECT pv."path" AS ruta, COUNT(*)::int AS visitas, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes
          FROM "PageView" pv WHERE ${inRange}
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.$queryRaw<{ seccion: string; visitas: number; visitantes: number }[]>`
          SELECT COALESCE(NULLIF(split_part(pv."path", '/', 2), ''), '(inicio)') AS seccion,
                 COUNT(*)::int AS visitas, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes
          FROM "PageView" pv WHERE ${inRange}
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        // document.referrer no cambia al navegar dentro del sitio (SPA): todas
        // las páginas de una sesión traen el referente de entrada. Se cuenta
        // una vez por sesión, en su primera página.
        prisma.$queryRaw<{ fuente: string; sesiones: number }[]>`
          WITH firsts AS (
            SELECT DISTINCT ON (COALESCE(pv."sessionId", pv."id"::text)) pv."referrer"
            FROM "PageView" pv WHERE ${inRange}
            ORDER BY COALESCE(pv."sessionId", pv."id"::text), pv."createdAt"
          )
          SELECT CASE
                   WHEN "referrer" IS NULL OR "referrer" = '' THEN '(directo)'
                   WHEN "referrer" ~* '^https?://([a-z0-9-]+[.])*uzeed[.]cl' THEN '(interno)'
                   ELSE COALESCE(substring("referrer" from '^(?:https?://)?(?:www[.])?([^/:?#]+)'), '(otro)')
                 END AS fuente,
                 COUNT(*)::int AS sesiones
          FROM firsts GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.$queryRaw<{ pagina: string; entradas: number }[]>`
          WITH firsts AS (
            SELECT DISTINCT ON (COALESCE(pv."sessionId", pv."id"::text)) pv."path"
            FROM "PageView" pv WHERE ${inRange}
            ORDER BY COALESCE(pv."sessionId", pv."id"::text), pv."createdAt"
          )
          SELECT "path" AS pagina, COUNT(*)::int AS entradas FROM firsts GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.$queryRaw<{ ciudad: string; visitantes: number; visitas: number }[]>`
          SELECT pv."city" AS ciudad, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes, COUNT(*)::int AS visitas
          FROM "PageView" pv WHERE ${inRange} AND pv."city" IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.$queryRaw<{ pais: string; visitantes: number; visitas: number }[]>`
          SELECT pv."country" AS pais, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes, COUNT(*)::int AS visitas
          FROM "PageView" pv WHERE ${inRange} AND pv."country" IS NOT NULL
          GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
        prisma.$queryRaw<{ accion: string; total: number; unicas: number }[]>`
          SELECT ua."action" AS accion, COUNT(*)::int AS total,
                 COUNT(DISTINCT (${actorKeySql("ua")} || ':' || COALESCE(ua."targetId"::text, '') || ':' ||
                   to_char(${localTs('ua."createdAt"')}, 'YYYY-MM-DD')))::int AS unicas
          FROM "UserAction" ua
          WHERE ua."createdAt" >= ${period.from} AND ua."createdAt" < ${period.to} AND ${realActionSql("ua")}
          GROUP BY 1 ORDER BY 2 DESC`,
      ]);
      return jsonResult({
        periodo: describePeriod(period),
        criterios: { trafico: CRITERIOS.trafico, clicks: CRITERIOS.clicks },
        resumen: summary,
        paginasMasVistas: topPaths,
        secciones: sections,
        fuentesDeEntrada: sources,
        paginasDeEntrada: landings,
        ciudades: cities,
        paises: countries,
        acciones: actions,
      });
    }),
  );
}
