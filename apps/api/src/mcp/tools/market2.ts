import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { config } from "../../config";
import { normalizeCity } from "../../lib/chileGeo";
import { guarded, type McpContext } from "../audit";
import { TZ, describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { describeFiltros, filtrosShape, pickFiltros, profileSql, withSegment, type Filtros } from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

export function registerMarketTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "oferta_demanda",
    {
      title: "Oferta vs demanda",
      description:
        "Por ciudad (o región/comuna) y categoría: anuncios publicados contra búsquedas, vistas de fichas y contactos del periodo. Marca zonas con demanda y poca oferta (oportunidad para captar anunciantes) y saturadas (mucha oferta, pocos contactos por anuncio) con un semáforo. Acepta filtros comunes.",
      inputSchema: {
        ...periodShape,
        ...filtrosShape,
        nivel: z.enum(["ciudad", "region", "comuna"]).optional().describe("Agrupación geográfica (por defecto ciudad)."),
        limite: z.number().int().min(1).max(200).optional(),
      },
      annotations: READ,
    },
    guarded("oferta_demanda", ctx, async (args: PeriodInput & Filtros & { nivel?: "ciudad" | "region" | "comuna"; limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const nivel = args.nivel ?? "ciudad";
      const pf = await profileSql(f, "u");
      const rows = await prisma.$queryRaw<{ city: string | null; categoria: string | null; anuncios: number; vistas: number; visitantes: number; contactos: number }[]>`
        WITH base AS (SELECT u."id", u."username", u."city", lower(COALESCE(u."primaryCategory", u."serviceCategory", '(sin categoría)')) AS categoria
                      FROM "User" u WHERE ${pf} AND u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP') AND u."isActive" AND u."isVerified")
        SELECT b."city", b.categoria, COUNT(DISTINCT b."id")::int AS anuncios,
          (SELECT COUNT(*) FROM "PageView" pv JOIN base b2 ON split_part(pv."path", '/', 3) IN (b2."id"::text, b2."username") AND b2."city" IS NOT DISTINCT FROM b."city" AND b2.categoria = b.categoria
             WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${period.from} AND pv."createdAt" < ${period.to} AND pv."path" NOT LIKE '/admin%')::int AS vistas,
          (SELECT COUNT(DISTINCT COALESCE(pv."visitorId", pv."sessionId", pv."id"::text)) FROM "PageView" pv JOIN base b2 ON split_part(pv."path", '/', 3) IN (b2."id"::text, b2."username") AND b2."city" IS NOT DISTINCT FROM b."city" AND b2.categoria = b.categoria
             WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${period.from} AND pv."createdAt" < ${period.to})::int AS visitantes,
          (SELECT COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || ua."targetId"::text || to_char((ua."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}, 'YYYY-MM-DD')))
             FROM "UserAction" ua JOIN base b2 ON b2."id" = ua."targetId" AND b2."city" IS NOT DISTINCT FROM b."city" AND b2.categoria = b.categoria
             WHERE ua."action" IN ('whatsapp_click','phone_click') AND ua."createdAt" >= ${period.from} AND ua."createdAt" < ${period.to})::int AS contactos
        FROM base b GROUP BY 1,2`;
      const searches = await prisma.$queryRaw<{ city: string | null; categoria: string | null; busquedas: number; sinResultados: number }[]>`
        SELECT sl."city", lower(COALESCE(sl."categorySlug", '(sin categoría)')) AS categoria, COUNT(*)::int AS busquedas, COUNT(*) FILTER (WHERE sl."resultCount" = 0)::int AS "sinResultados"
        FROM "SearchLog" sl WHERE sl."createdAt" >= ${period.from} AND sl."createdAt" < ${period.to} GROUP BY 1,2`;

      const keyOf = (city: string | null) => normalizeCity(city)[nivel];
      type Cell = { zona: string; categoria: string; anuncios: number; vistas: number; visitantes: number; contactos: number; busquedas: number; busquedasSinResultados: number };
      const cells = new Map<string, Cell>();
      const get = (zona: string, categoria: string) => {
        const k = `${zona}||${categoria}`;
        let c = cells.get(k);
        if (!c) { c = { zona, categoria, anuncios: 0, vistas: 0, visitantes: 0, contactos: 0, busquedas: 0, busquedasSinResultados: 0 }; cells.set(k, c); }
        return c;
      };
      for (const r of rows) { const c = get(keyOf(r.city), r.categoria ?? "(sin categoría)"); c.anuncios += r.anuncios; c.vistas += r.vistas; c.visitantes += r.visitantes; c.contactos += r.contactos; }
      for (const s of searches) { const c = get(keyOf(s.city), s.categoria ?? "(sin categoría)"); c.busquedas += s.busquedas; c.busquedasSinResultados += s.sinResultados; }

      const all = [...cells.values()];
      const totalContactos = all.reduce((a, c) => a + c.contactos, 0);
      const totalAnuncios = all.reduce((a, c) => a + c.anuncios, 0);
      const mediaContactosPorAnuncio = totalAnuncios ? totalContactos / totalAnuncios : 0;
      const tabla = all
        .map((c) => {
          const demanda = c.vistas + c.contactos * 5 + c.busquedas * 2;
          const contactosPorAnuncio = c.anuncios ? c.contactos / c.anuncios : null;
          const vistasPorAnuncio = c.anuncios ? c.vistas / c.anuncios : null;
          let semaforo: "oportunidad" | "saturada" | "equilibrada" | "sin_datos" = "equilibrada";
          if (demanda < 10 && c.anuncios === 0) semaforo = "sin_datos";
          else if (c.anuncios === 0 && demanda >= 10) semaforo = "oportunidad";
          else if (c.anuncios <= 3 && (contactosPorAnuncio ?? 0) >= Math.max(1, mediaContactosPorAnuncio * 1.5)) semaforo = "oportunidad";
          else if (c.busquedasSinResultados >= 5) semaforo = "oportunidad";
          else if (c.anuncios >= 10 && (contactosPorAnuncio ?? 0) <= mediaContactosPorAnuncio * 0.5) semaforo = "saturada";
          return {
            [nivel]: c.zona,
            categoria: c.categoria,
            anunciosPublicados: c.anuncios,
            busquedas: c.busquedas,
            busquedasSinResultados: c.busquedasSinResultados,
            vistasFichas: c.vistas,
            visitantesFichas: c.visitantes,
            contactos: c.contactos,
            contactosPorAnuncio: contactosPorAnuncio != null ? Math.round(contactosPorAnuncio * 100) / 100 : null,
            vistasPorAnuncio: vistasPorAnuncio != null ? Math.round(vistasPorAnuncio * 10) / 10 : null,
            indiceDemanda: demanda,
            semaforo,
          };
        })
        .sort((a, b) => b.indiceDemanda - a.indiceDemanda)
        .slice(0, args.limite ?? 60);
      return jsonResult({
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        nivel,
        mediaContactosPorAnuncio: Math.round(mediaContactosPorAnuncio * 100) / 100,
        tabla,
        criterios: "Índice de demanda = vistas + 5×contactos + 2×búsquedas. Oportunidad = demanda sin anuncios, pocos anuncios con muchos contactos cada uno, o búsquedas sin resultados. Saturada = 10+ anuncios con la mitad o menos de contactos por anuncio que la media.",
        grafico: "mapa por comuna/región coloreado por semáforo y tabla",
      });
    }),
  );

  server.registerTool(
    "monetizacion",
    {
      title: "Monetización de anuncios",
      description:
        "Planes: ingresos por tier y propósito, MRR (membresías activas × precio), renovaciones vs primeras compras, churn (membresías vencidas sin renovar en el periodo) y conversión de gratis a pago (registros que pagaron dentro de N días). Acepta filtros comunes de perfil.",
      inputSchema: { ...periodShape, ...filtrosShape, diasConversion: z.number().int().min(1).max(180).optional().describe("Ventana para conversión gratis→pago (por defecto 30).") },
      annotations: READ,
    },
    guarded("monetizacion", ctx, async (args: PeriodInput & Filtros & { diasConversion?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const pf = await profileSql(f, "u");
      const paid = Prisma.sql`pi."status" = 'PAID' AND pi."paidAt" >= ${period.from} AND pi."paidAt" < ${period.to}`;
      const window = args.diasConversion ?? 30;
      const [porTier, porProposito, renov, churn, conv, mrr] = await Promise.all([
        prisma.$queryRaw<{ tier: string; clp: number; pagos: number; pagadores: number }[]>`
          SELECT COALESCE(u."tier"::text, 'NINGUNO') AS tier, COALESCE(SUM(pi."amount"), 0)::int AS clp, COUNT(*)::int AS pagos, COUNT(DISTINCT pi."subscriberId")::int AS pagadores
          FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId" AND ${pf} WHERE ${paid} GROUP BY 1 ORDER BY 2 DESC`,
        prisma.$queryRaw<{ proposito: string; clp: number; pagos: number }[]>`
          SELECT pi."purpose"::text AS proposito, COALESCE(SUM(pi."amount"), 0)::int AS clp, COUNT(*)::int AS pagos
          FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId" AND ${pf} WHERE ${paid} GROUP BY 1 ORDER BY 2 DESC`,
        prisma.$queryRaw<{ primeras: number; renovaciones: number; clpPrimeras: number; clpRenovaciones: number }[]>`
          SELECT COUNT(*) FILTER (WHERE NOT prev)::int AS primeras, COUNT(*) FILTER (WHERE prev)::int AS renovaciones,
            COALESCE(SUM(amount) FILTER (WHERE NOT prev), 0)::int AS "clpPrimeras", COALESCE(SUM(amount) FILTER (WHERE prev), 0)::int AS "clpRenovaciones"
          FROM (SELECT pi."amount", EXISTS (SELECT 1 FROM "PaymentIntent" o WHERE o."subscriberId" = pi."subscriberId" AND o."status" = 'PAID' AND o."purpose" = pi."purpose" AND o."paidAt" < pi."paidAt") AS prev
                FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId" AND ${pf}
                WHERE ${paid} AND pi."purpose" IN ('MEMBERSHIP_PLAN','SHOP_PLAN','PUBLICATE_GOLD')) t`,
        prisma.$queryRaw<{ vencidas: number; renovadas: number; perdidas: number }[]>`
          WITH exp AS (
            SELECT u."id", u."membershipExpiresAt" FROM "User" u WHERE ${pf} AND u."membershipExpiresAt" >= ${period.from} AND u."membershipExpiresAt" < ${period.to}
          )
          SELECT COUNT(*)::int AS vencidas,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = exp."id" AND pi."status" = 'PAID' AND pi."paidAt" >= exp."membershipExpiresAt" - interval '7 days' AND pi."paidAt" < exp."membershipExpiresAt" + interval '14 days'))::int AS renovadas,
            COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = exp."id" AND pi."status" = 'PAID' AND pi."paidAt" >= exp."membershipExpiresAt" - interval '7 days') AND exp."membershipExpiresAt" < now() - interval '14 days')::int AS perdidas
          FROM exp`,
        prisma.$queryRaw<{ registros: number; pagaron: number }[]>`
          SELECT COUNT(*)::int AS registros,
            COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "PaymentIntent" pi WHERE pi."subscriberId" = u."id" AND pi."status" = 'PAID' AND pi."paidAt" <= u."createdAt" + make_interval(days => ${window}::int)))::int AS pagaron
          FROM "User" u WHERE ${pf} AND u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP') AND u."adminManaged" = false
            AND u."createdAt" >= ${period.from} AND u."createdAt" < ${period.to} AND u."createdAt" <= now() - make_interval(days => ${window}::int)`,
        prisma.$queryRaw<{ activas: number }[]>`
          SELECT COUNT(*)::int AS activas FROM "User" u WHERE ${pf} AND u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP') AND u."membershipExpiresAt" > now()`,
      ]);
      const r = renov[0];
      const c = churn[0];
      const v = conv[0];
      return jsonResult({
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        ingresosPorTier: porTier,
        ingresosPorProposito: porProposito,
        mrr: { membresiasActivas: mrr[0].activas, precioMensualClp: config.membershipPriceClp, mrrClp: mrr[0].activas * config.membershipPriceClp, criterio: "Foto actual: membresías vigentes × precio mensual." },
        renovaciones: { primerasCompras: r.primeras, renovaciones: r.renovaciones, clpPrimeras: r.clpPrimeras, clpRenovaciones: r.clpRenovaciones, pctRenovaciones: r.primeras + r.renovaciones ? Math.round((r.renovaciones / (r.primeras + r.renovaciones)) * 1000) / 10 : null },
        churn: { membresiasVencidasEnPeriodo: c.vencidas, renovadas: c.renovadas, perdidas: c.perdidas, churnPct: c.vencidas ? Math.round((c.perdidas / c.vencidas) * 1000) / 10 : null, criterio: "Perdida = venció hace más de 14 días y no hubo pago alrededor del vencimiento." },
        conversionGratisAPago: { registrosEvaluados: v.registros, pagaronDentroDeVentana: v.pagaron, pct: v.registros ? Math.round((v.pagaron / v.registros) * 1000) / 10 : null, ventanaDias: window, criterio: "Sólo registros con al menos N días de antigüedad, para que la ventana sea justa." },
        grafico: "barras por tier; línea de MRR con serie_temporal ingresos_clp",
      });
    }),
  );

  server.registerTool(
    "verticales",
    {
      title: "Verticales: marketplace, U-Mate, videollamadas, tokens y live",
      description:
        "Estado ON/OFF de cada vertical (ON = tuvo actividad en los últimos 90 días o tiene configuración activa) y, sólo para las que están ON, sus métricas del periodo. Así no ensucian el panel con ceros.",
      inputSchema: { ...periodShape },
      annotations: READ,
    },
    guarded("verticales", ctx, async (args: PeriodInput) => {
      const period = resolvePeriod(args);
      const r = { gte: period.from, lt: period.to };
      const since90 = new Date(Date.now() - 90 * 86400000);
      const [marketOn, umateOn, videoOn, tokensOn, liveOn] = await Promise.all([
        prisma.marketOrder.count({ where: { createdAt: { gte: since90 } } }).then((n) => n > 0),
        prisma.umateDirectSubscription.count({ where: { createdAt: { gte: since90 } } }).then(async (n) => n > 0 || (await prisma.umateCreator.count({ where: { status: "ACTIVE" } })) > 0),
        prisma.videocallBooking.count({ where: { createdAt: { gte: since90 } } }).then(async (n) => n > 0 || (await prisma.videocallConfig.count()) > 0),
        prisma.tokenDeposit.count({ where: { createdAt: { gte: since90 } } }).then((n) => n > 0),
        prisma.liveStream.count({ where: { startedAt: { gte: since90 } } }).then((n) => n > 0),
      ]);
      const out: Record<string, unknown> = { periodo: describePeriod(period), estado: { marketplace: marketOn, umate: umateOn, videollamadas: videoOn, tokens: tokensOn, live: liveOn } };
      if (marketOn) {
        const [orders, paid] = await Promise.all([
          prisma.marketOrder.groupBy({ by: ["status"], where: { createdAt: r }, _count: { _all: true } }),
          prisma.marketOrder.aggregate({ where: { paidAt: r, status: { in: ["PAID", "PREPARING", "DELIVERED", "COMPLETED", "DISPUTED"] } }, _sum: { totalClp: true, commissionClp: true }, _count: { _all: true } }),
        ]);
        out.marketplace = { pedidosPorEstado: orders.map((o) => ({ estado: o.status, pedidos: o._count._all })), pagados: paid._count._all, ventasClp: paid._sum.totalClp || 0, comisionClp: paid._sum.commissionClp || 0 };
      }
      if (umateOn) {
        const [subs, creators, ledger] = await Promise.all([
          prisma.umateDirectSubscription.groupBy({ by: ["status"], _count: { _all: true } }),
          prisma.umateCreator.count({ where: { status: "ACTIVE" } }),
          prisma.umateLedgerEntry.aggregate({ where: { createdAt: r }, _sum: { grossAmount: true, platformFee: true } }),
        ]);
        out.umate = { creadorasActivas: creators, suscripcionesPorEstado: subs.map((s) => ({ estado: s.status, total: s._count._all })), nuevasEnPeriodo: await prisma.umateDirectSubscription.count({ where: { createdAt: r } }), brutoClp: ledger._sum.grossAmount || 0, comisionClp: ledger._sum.platformFee || 0 };
      }
      if (videoOn) {
        const b = await prisma.videocallBooking.groupBy({ by: ["status"], where: { createdAt: r }, _count: { _all: true }, _sum: { totalTokens: true } });
        out.videollamadas = { reservasPorEstado: b.map((x) => ({ estado: x.status, reservas: x._count._all, tokens: x._sum.totalTokens || 0 })), profesionalesConConfig: await prisma.videocallConfig.count() };
      }
      if (tokensOn) {
        const [dep, wd, tx] = await Promise.all([
          prisma.tokenDeposit.groupBy({ by: ["status", "method"], where: { createdAt: r }, _count: { _all: true }, _sum: { clpAmount: true } }),
          prisma.withdrawalRequest.groupBy({ by: ["status"], where: { createdAt: r }, _count: { _all: true }, _sum: { clpAmount: true } }),
          prisma.tokenTransaction.groupBy({ by: ["type"], where: { createdAt: r }, _count: { _all: true }, _sum: { amount: true } }),
        ]);
        out.tokens = { depositos: dep.map((d) => ({ estado: d.status, metodo: d.method, total: d._count._all, clp: d._sum.clpAmount || 0 })), retiros: wd.map((w) => ({ estado: w.status, total: w._count._all, clp: w._sum.clpAmount || 0 })), movimientos: tx.map((t) => ({ tipo: t.type, total: t._count._all, tokens: t._sum.amount || 0 })) };
      }
      if (liveOn) {
        const [streams, tips] = await Promise.all([
          prisma.liveStream.count({ where: { startedAt: r } }),
          prisma.liveTip.aggregate({ where: { createdAt: r }, _count: { _all: true }, _sum: { amount: true } }).catch(() => ({ _count: { _all: 0 }, _sum: { amount: 0 } })),
        ]);
        out.live = { streams, propinas: tips._count._all, propinasTokens: tips._sum.amount || 0 };
      }
      return jsonResult(out);
    }),
  );
}
