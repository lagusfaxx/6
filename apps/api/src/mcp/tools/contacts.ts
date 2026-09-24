import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { normalizeCity } from "../../lib/chileGeo";
import { staffIdsSql } from "../../lib/statsFilters";
import { guarded, type McpContext } from "../audit";
import { describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { localTs } from "../metrics";
import { contactKeySql, describeFiltros, filtrosShape, pickFiltros, profileSql, trafficCtes, withSegment, type Filtros } from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

export function registerContactTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "contactos_detalle",
    {
      title: "Contactos en detalle",
      description:
        "Todo sobre los contactos (WhatsApp, llamada y mensaje interno) en un periodo: desglose por perfil, ciudad, categoría, hora del día y fuente de tráfico; contactos únicos vs repetidos (el mismo visitante al mismo perfil); tiempo entre la entrada al sitio y el primer contacto; y para los mensajes internos, tasa y tiempo de respuesta de las profesionales y el efecto de la respuesta automática. Acepta filtros comunes.",
      inputSchema: { ...periodShape, ...filtrosShape, limite: z.number().int().min(1).max(100).optional() },
      annotations: READ,
    },
    guarded("contactos_detalle", ctx, async (args: PeriodInput & Filtros & { limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const ctes = await trafficCtes(period, f);
      const pf = await profileSql(f, "u");
      const q = <T>(sql: Prisma.Sql) => prisma.$queryRaw<T[]>`${ctes} ${sql}`;
      // Acciones de contacto de perfiles que pasan el filtro.
      const contactos = Prisma.sql`uaf JOIN "User" u ON u."id" = uaf."targetId" AND ${pf} WHERE uaf."action" IN ('whatsapp_click','phone_click')`;

      const [totales, porPerfil, porCiudad, porCategoria, porHora, porFuente, tiempoPrimerContacto] = await Promise.all([
        q<{ clicks: number; unicos: number; personas: number; perfiles: number; whatsapp: number; telefono: number; repetidores: number }>(Prisma.sql`
          , c AS (SELECT uaf.akey, uaf."targetId", uaf."action", ${contactKeySql("uaf")} AS ckey FROM ${contactos})
          SELECT COUNT(*)::int AS clicks, COUNT(DISTINCT ckey)::int AS unicos, COUNT(DISTINCT akey)::int AS personas, COUNT(DISTINCT "targetId")::int AS perfiles,
            COUNT(DISTINCT ckey) FILTER (WHERE "action" = 'whatsapp_click')::int AS whatsapp,
            COUNT(DISTINCT ckey) FILTER (WHERE "action" = 'phone_click')::int AS telefono,
            (SELECT COUNT(*) FROM (SELECT akey, "targetId" FROM c GROUP BY 1,2 HAVING COUNT(DISTINCT ckey) > 1) r)::int AS repetidores
          FROM c`),
        q<{ username: string; nombre: string | null; ciudad: string | null; tier: string | null; unicos: number; clicks: number; whatsapp: number; telefono: number }>(Prisma.sql`
          SELECT u."username", u."displayName" AS nombre, u."city" AS ciudad, u."tier"::text AS tier,
            COUNT(DISTINCT ${contactKeySql("uaf")})::int AS unicos, COUNT(*)::int AS clicks,
            COUNT(DISTINCT ${contactKeySql("uaf")}) FILTER (WHERE uaf."action" = 'whatsapp_click')::int AS whatsapp,
            COUNT(DISTINCT ${contactKeySql("uaf")}) FILTER (WHERE uaf."action" = 'phone_click')::int AS telefono
          FROM ${contactos} GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT ${take}`),
        q<{ ciudad: string | null; unicos: number; perfiles: number }>(Prisma.sql`
          SELECT u."city" AS ciudad, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS unicos, COUNT(DISTINCT u."id")::int AS perfiles FROM ${contactos} GROUP BY 1 ORDER BY 2 DESC LIMIT 200`),
        q<{ categoria: string | null; unicos: number; perfiles: number }>(Prisma.sql`
          SELECT lower(COALESCE(u."primaryCategory", u."serviceCategory", '(sin categoría)')) AS categoria, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS unicos, COUNT(DISTINCT u."id")::int AS perfiles
          FROM ${contactos} GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`),
        q<{ hora: number; unicos: number }>(Prisma.sql`
          SELECT EXTRACT(HOUR FROM ${localTs('uaf."createdAt"')})::int AS hora, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS unicos FROM ${contactos} GROUP BY 1 ORDER BY 1`),
        q<{ fuente: string; unicos: number; sesiones: number }>(Prisma.sql`
          SELECT COALESCE(f2.fuente, '(sin sesión)') AS fuente, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS unicos,
            (SELECT COUNT(*) FROM fs WHERE fs.fuente = f2.fuente)::int AS sesiones
          FROM uaf JOIN "User" u ON u."id" = uaf."targetId" AND ${pf} LEFT JOIN fs f2 ON COALESCE(uaf."sessionId", '') = f2.skey
          WHERE uaf."action" IN ('whatsapp_click','phone_click') GROUP BY f2.fuente ORDER BY 2 DESC`),
        q<{ p50: number | null; p90: number | null; promedio: number | null; n: number }>(Prisma.sql`
          , first_contact AS (
            SELECT fs.skey, MIN(uaf."createdAt") AS at, fs.started
            FROM fs JOIN uaf ON COALESCE(uaf."sessionId", '') = fs.skey
            WHERE uaf."action" IN ('whatsapp_click','phone_click') GROUP BY 1,3
          )
          SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (at - started)))::float8 AS p50,
                 percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (at - started)))::float8 AS p90,
                 AVG(EXTRACT(EPOCH FROM (at - started)))::float8 AS promedio, COUNT(*)::int AS n
          FROM first_contact`),
      ]);

      // Mensajes internos: respuesta de la profesional al primer mensaje de cada cliente.
      const created = Prisma.sql`m."createdAt" >= ${period.from} AND m."createdAt" < ${period.to}`;
      const [mensajeria] = await prisma.$queryRaw<{ conversaciones: number; respondidas: number; p50_min: number | null; promedio_min: number | null; con_auto: number; con_auto_respondidas: number; sin_auto: number; sin_auto_respondidas: number }[]>`
        WITH firsts AS (
          SELECT m."fromId" AS client, m."toId" AS pro, MIN(m."createdAt") AS first_at
          FROM "Message" m JOIN "User" u ON u."id" = m."toId" AND ${pf}
          WHERE ${created} AND m."fromId" NOT IN ${staffIdsSql()}
            AND u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP')
            AND NOT EXISTS (SELECT 1 FROM "Message" o WHERE o."fromId" = m."fromId" AND o."toId" = m."toId" AND o."createdAt" < ${period.from})
          GROUP BY 1,2
        ), replies AS (
          SELECT f.client, f.pro, f.first_at,
            (SELECT MIN(r."createdAt") FROM "Message" r WHERE r."fromId" = f.pro AND r."toId" = f.client AND r."createdAt" > f.first_at
               AND NOT EXISTS (SELECT 1 FROM "AutoReplyLog" al WHERE al."professionalId" = f.pro AND al."clientId" = f.client AND abs(EXTRACT(EPOCH FROM (al."sentAt" - r."createdAt"))) < 5)) AS reply_at,
            EXISTS (SELECT 1 FROM "AutoReplyLog" al WHERE al."professionalId" = f.pro AND al."clientId" = f.client AND al."sentAt" >= f.first_at AND al."sentAt" < f.first_at + interval '1 hour') AS auto
          FROM firsts f
        )
        SELECT COUNT(*)::int AS conversaciones, COUNT(reply_at)::int AS respondidas,
          (percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (reply_at - first_at)) / 60))::float8 AS p50_min,
          (AVG(EXTRACT(EPOCH FROM (reply_at - first_at)) / 60))::float8 AS promedio_min,
          COUNT(*) FILTER (WHERE auto)::int AS con_auto, COUNT(reply_at) FILTER (WHERE auto)::int AS con_auto_respondidas,
          COUNT(*) FILTER (WHERE NOT auto)::int AS sin_auto, COUNT(reply_at) FILTER (WHERE NOT auto)::int AS sin_auto_respondidas
        FROM replies`;

      const t = totales[0];
      const geo = new Map<string, { unicos: number; perfiles: number }>();
      for (const r of porCiudad) {
        const g = normalizeCity(r.ciudad);
        const cur = geo.get(g.ciudad) ?? { unicos: 0, perfiles: 0 };
        cur.unicos += r.unicos; cur.perfiles += r.perfiles; geo.set(g.ciudad, cur);
      }
      const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
      return jsonResult({
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        totales: {
          contactosUnicos: t.unicos,
          clicksBrutos: t.clicks,
          personasDistintas: t.personas,
          perfilesContactados: t.perfiles,
          porCanal: { whatsapp: t.whatsapp, telefono: t.telefono, mensajeInterno: mensajeria.conversaciones },
          repetidos: { paresPersonaPerfilConMasDeUnContacto: t.repetidores, criterio: "mismo visitante contactando al mismo perfil en más de un día" },
        },
        porPerfil,
        porCiudad: [...geo.entries()].map(([ciudad, v]) => ({ ciudad, ...v, contactosPorPerfil: v.perfiles ? Math.round((v.unicos / v.perfiles) * 10) / 10 : 0 })).sort((a, b) => b.unicos - a.unicos).slice(0, take),
        porCategoria,
        porHora: { puntos: porHora, grafico: "barras por hora (Chile)" },
        porFuente,
        tiempoAlPrimerContacto: {
          sesionesConContacto: tiempoPrimerContacto[0]?.n ?? 0,
          medianaSegundos: tiempoPrimerContacto[0]?.p50 != null ? Math.round(Number(tiempoPrimerContacto[0].p50)) : null,
          p90Segundos: tiempoPrimerContacto[0]?.p90 != null ? Math.round(Number(tiempoPrimerContacto[0].p90)) : null,
          promedioSegundos: tiempoPrimerContacto[0]?.promedio != null ? Math.round(Number(tiempoPrimerContacto[0].promedio)) : null,
          criterio: "desde la primera página de la sesión hasta su primer click de contacto",
        },
        mensajesInternos: {
          conversacionesNuevas: mensajeria.conversaciones,
          respondidasPorLaProfesional: mensajeria.respondidas,
          tasaRespuestaPct: pct(mensajeria.respondidas, mensajeria.conversaciones),
          tiempoRespuestaMedianaMin: mensajeria.p50_min != null ? Math.round(Number(mensajeria.p50_min)) : null,
          tiempoRespuestaPromedioMin: mensajeria.promedio_min != null ? Math.round(Number(mensajeria.promedio_min)) : null,
          efectoRespuestaAutomatica: {
            conAutoRespuesta: { conversaciones: mensajeria.con_auto, respondidasDespues: mensajeria.con_auto_respondidas, tasaPct: pct(mensajeria.con_auto_respondidas, mensajeria.con_auto) },
            sinAutoRespuesta: { conversaciones: mensajeria.sin_auto, respondidas: mensajeria.sin_auto_respondidas, tasaPct: pct(mensajeria.sin_auto_respondidas, mensajeria.sin_auto) },
            criterio: "La respuesta automática no cuenta como respuesta; se mide si la profesional respondió de verdad después.",
          },
        },
      });
    }),
  );
}
