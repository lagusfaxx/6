import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { BOT_UA_PATTERN, actorKeySql, realActionSql, realPageViewSql, staffIdsSql, visitorKeySql } from "../lib/statsFilters";
import { TZ } from "./helpers";

/**
 * Métricas de actividad con los mismos criterios en todas las herramientas:
 * sin bots, sin el equipo y sin el panel; visitantes por `visitorId`; clicks
 * deduplicados por persona, perfil y día.
 */

export type Range = { from: Date; to: Date };

/** Timestamp local de Chile de una columna "timestamp without time zone" guardada en UTC. */
export function localTs(column: string): Prisma.Sql {
  return Prisma.raw(`((${column} AT TIME ZONE 'UTC') AT TIME ZONE '${TZ}')`);
}

export async function trafficSummary({ from, to }: Range) {
  const clean = realPageViewSql("pv");
  const rows = await prisma.$queryRaw<
    {
      visitas: number;
      brutas: number;
      bots: number;
      equipo: number;
      panel: number;
      visitantes: number;
      sesiones: number;
      visitas_fichas: number;
      con_sesion: number;
      sin_visitor: number;
    }[]
  >`
    SELECT
      COUNT(*) FILTER (WHERE ${clean})::int AS visitas,
      COUNT(*)::int AS brutas,
      COUNT(*) FILTER (WHERE pv."userAgent" ~* ${BOT_UA_PATTERN})::int AS bots,
      COUNT(*) FILTER (WHERE pv."userId" IN ${staffIdsSql()})::int AS equipo,
      COUNT(*) FILTER (WHERE pv."path" LIKE '/admin%')::int AS panel,
      COUNT(DISTINCT ${visitorKeySql("pv")}) FILTER (WHERE ${clean})::int AS visitantes,
      COUNT(DISTINCT COALESCE(pv."sessionId", pv."id"::text)) FILTER (WHERE ${clean})::int AS sesiones,
      COUNT(*) FILTER (WHERE ${clean} AND pv."path" LIKE '/profesional/%')::int AS visitas_fichas,
      COUNT(*) FILTER (WHERE ${clean} AND pv."userId" IS NOT NULL)::int AS con_sesion,
      COUNT(*) FILTER (WHERE ${clean} AND pv."visitorId" IS NULL)::int AS sin_visitor
    FROM "PageView" pv
    WHERE pv."createdAt" >= ${from} AND pv."createdAt" < ${to}`;
  const r = rows[0];
  return {
    visitas: r.visitas,
    visitantesUnicos: r.visitantes,
    sesiones: r.sesiones,
    paginasPorSesion: r.sesiones ? Math.round((r.visitas / r.sesiones) * 10) / 10 : null,
    visitasFichas: r.visitas_fichas,
    pctConSesionIniciada: r.visitas ? Math.round((r.con_sesion / r.visitas) * 1000) / 10 : null,
    excluidas: {
      total: r.brutas - r.visitas,
      bots: r.bots,
      equipo: r.equipo,
      panelAdmin: r.panel,
    },
    // Visitas registradas antes de que existiera visitorId: ahí el visitante
    // se aproxima por pestaña y el número de únicos sale algo inflado.
    pctVisitasSinVisitorId: r.visitas ? Math.round((r.sin_visitor / r.visitas) * 1000) / 10 : null,
  };
}

/**
 * Clicks de una acción: brutos, sin el equipo, y únicos (una persona, un
 * perfil, un día). Los únicos son el número que sirve para "contactos".
 */
export async function clickSummary(action: string, { from, to }: Range) {
  const rows = await prisma.$queryRaw<{ brutos: number; clicks: number; unicos: number; personas: number; perfiles: number }[]>`
    SELECT
      COUNT(*)::int AS brutos,
      COUNT(*) FILTER (WHERE ${realActionSql("ua")})::int AS clicks,
      COUNT(DISTINCT (${actorKeySql("ua")} || ':' || COALESCE(ua."targetId"::text, '') || ':' ||
        to_char(${localTs('ua."createdAt"')}, 'YYYY-MM-DD'))) FILTER (WHERE ${realActionSql("ua")})::int AS unicos,
      COUNT(DISTINCT ${actorKeySql("ua")}) FILTER (WHERE ${realActionSql("ua")})::int AS personas,
      COUNT(DISTINCT ua."targetId") FILTER (WHERE ${realActionSql("ua")})::int AS perfiles
    FROM "UserAction" ua
    WHERE ua."action" = ${action} AND ua."createdAt" >= ${from} AND ua."createdAt" < ${to}`;
  const r = rows[0];
  return {
    contactosUnicos: r.unicos,
    clicks: r.clicks,
    personas: r.personas,
    perfilesContactados: r.perfiles,
    clicksDelEquipoExcluidos: r.brutos - r.clicks,
  };
}

/**
 * Mensajería sin el equipo (soporte escribiendo a usuarios no es actividad
 * del sitio). "Conversaciones nuevas" son pares que se escriben por primera
 * vez en el rango.
 */
export async function messagingSummary({ from, to }: Range) {
  const rows = await prisma.$queryRaw<{ mensajes: number; remitentes: number; activas: number; nuevas: number }[]>`
    WITH m AS (
      SELECT "fromId", "toId", LEAST("fromId", "toId") AS a, GREATEST("fromId", "toId") AS b
      FROM "Message"
      WHERE "createdAt" >= ${from} AND "createdAt" < ${to}
        AND "fromId" NOT IN ${staffIdsSql()} AND "toId" NOT IN ${staffIdsSql()}
    ), pairs AS (SELECT DISTINCT a, b FROM m)
    SELECT
      (SELECT COUNT(*) FROM m)::int AS mensajes,
      (SELECT COUNT(DISTINCT "fromId") FROM m)::int AS remitentes,
      (SELECT COUNT(*) FROM pairs)::int AS activas,
      (SELECT COUNT(*) FROM pairs p WHERE NOT EXISTS (
        SELECT 1 FROM "Message" o
        WHERE o."createdAt" < ${from}
          AND ((o."fromId" = p.a AND o."toId" = p.b) OR (o."fromId" = p.b AND o."toId" = p.a))
      ))::int AS nuevas`;
  const r = rows[0];
  return {
    mensajes: r.mensajes,
    remitentesUnicos: r.remitentes,
    conversacionesActivas: r.activas,
    conversacionesNuevas: r.nuevas,
  };
}
