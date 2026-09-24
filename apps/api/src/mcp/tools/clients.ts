import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { staffIdsSql } from "../../lib/statsFilters";
import { guarded, type McpContext } from "../audit";
import { TZ, describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { contactKeySql, describeFiltros, filtrosShape, pickFiltros, trafficCtes, withSegment, type Filtros } from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const SECCIONES = ["base", "comportamiento", "favoritos", "retencion"] as const;

export function registerClientTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "clientes",
    {
      title: "Clientes y visitantes",
      description:
        "Secciones: base (registrados vs anónimos, recurrencia y frecuencia de visita); comportamiento (perfiles vistos por sesión, contactos por cliente); " +
        "favoritos (cuántos agregan y a qué perfiles); retencion (cohortes semanales de visitantes nuevos: % que vuelve en la semana 1, 2, 4 y 8). Acepta filtros comunes de tráfico.",
      inputSchema: { ...periodShape, ...filtrosShape, secciones: z.array(z.enum(SECCIONES)).optional(), limite: z.number().int().min(1).max(100).optional() },
      annotations: READ,
    },
    guarded("clientes", ctx, async (args: PeriodInput & Filtros & { secciones?: (typeof SECCIONES)[number][]; limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const wanted = new Set(args.secciones?.length ? args.secciones : SECCIONES);
      const ctes = await trafficCtes(period, f);
      const q = <T>(sql: Prisma.Sql) => prisma.$queryRaw<T[]>`${ctes} ${sql}`;
      const out: Record<string, unknown> = { periodo: describePeriod(period), filtros: describeFiltros(f) };

      if (wanted.has("base")) {
        const [r] = await q<{ visitantes: number; registrados: number; anonimos: number; nuevos: number; recurrentes: number; sesiones: number; clientesRegistradosTotal: number; clientesNuevos: number }>(Prisma.sql`
          SELECT COUNT(DISTINCT fs.vkey)::int AS visitantes,
            COUNT(DISTINCT fs.vkey) FILTER (WHERE fs."userId" IS NOT NULL)::int AS registrados,
            COUNT(DISTINCT fs.vkey) FILTER (WHERE fs."userId" IS NULL)::int AS anonimos,
            COUNT(DISTINCT fs.vkey) FILTER (WHERE fs.nuevo)::int AS nuevos,
            COUNT(DISTINCT fs.vkey) FILTER (WHERE NOT fs.nuevo)::int AS recurrentes,
            COUNT(*)::int AS sesiones,
            (SELECT COUNT(*) FROM "User" u WHERE u."profileType" IN ('CLIENT','VIEWER') AND u."role" = 'USER' AND u."email" NOT LIKE '%@testseed.uzeed.cl')::int AS "clientesRegistradosTotal",
            (SELECT COUNT(*) FROM "User" u WHERE u."profileType" IN ('CLIENT','VIEWER') AND u."role" = 'USER' AND u."createdAt" >= ${period.from} AND u."createdAt" < ${period.to})::int AS "clientesNuevos"
          FROM fs`);
        const frecuencia = await q<{ sesiones: number; visitantes: number }>(Prisma.sql`
          SELECT LEAST(n, 10)::int AS sesiones, COUNT(*)::int AS visitantes FROM (SELECT vkey, COUNT(*) AS n FROM fs GROUP BY 1) t GROUP BY 1 ORDER BY 1`);
        out.base = {
          visitantesUnicos: r.visitantes,
          registradosVsAnonimos: { registrados: r.registrados, anonimos: r.anonimos, pctRegistrados: r.visitantes ? Math.round((r.registrados / r.visitantes) * 1000) / 10 : null },
          nuevosVsRecurrentes: { nuevos: r.nuevos, recurrentes: r.recurrentes, pctRecurrentes: r.visitantes ? Math.round((r.recurrentes / r.visitantes) * 1000) / 10 : null },
          sesionesPorVisitante: r.visitantes ? Math.round((r.sesiones / r.visitantes) * 100) / 100 : null,
          frecuencia: frecuencia.map((x) => ({ sesiones: x.sesiones === 10 ? "10+" : x.sesiones, visitantes: x.visitantes })),
          cuentasCliente: { total: r.clientesRegistradosTotal, nuevasEnPeriodo: r.clientesNuevos },
        };
      }

      if (wanted.has("comportamiento")) {
        const [r] = await q<{ fichasPorSesion: number; sesionesConFicha: number; sesiones: number; personasQueContactan: number; contactosPorPersona: number; perfilesPorPersona: number }>(Prisma.sql`
          , c AS (SELECT uaf.akey, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS contactos, COUNT(DISTINCT uaf."targetId")::int AS perfiles FROM uaf WHERE uaf."action" IN ('whatsapp_click','phone_click') GROUP BY 1)
          SELECT COALESCE(AVG(fs.profiles_seen), 0)::float8 AS "fichasPorSesion", COUNT(*) FILTER (WHERE fs.profiles_seen > 0)::int AS "sesionesConFicha", COUNT(*)::int AS sesiones,
            (SELECT COUNT(*) FROM c)::int AS "personasQueContactan", (SELECT COALESCE(AVG(contactos), 0) FROM c)::float8 AS "contactosPorPersona", (SELECT COALESCE(AVG(perfiles), 0) FROM c)::float8 AS "perfilesPorPersona"
          FROM fs`);
        const distFichas = await q<{ fichas: number; sesiones: number }>(Prisma.sql`
          SELECT LEAST(fs.profiles_seen, 10)::int AS fichas, COUNT(*)::int AS sesiones FROM fs GROUP BY 1 ORDER BY 1`);
        out.comportamiento = {
          fichasVistasPorSesion: Math.round(Number(r.fichasPorSesion) * 100) / 100,
          pctSesionesQueVenFichas: r.sesiones ? Math.round((r.sesionesConFicha / r.sesiones) * 1000) / 10 : null,
          distribucionFichasPorSesion: distFichas.map((x) => ({ fichas: x.fichas === 10 ? "10+" : x.fichas, sesiones: x.sesiones })),
          contactos: { personasQueContactaron: r.personasQueContactan, contactosPorPersona: Math.round(Number(r.contactosPorPersona) * 100) / 100, perfilesContactadosPorPersona: Math.round(Number(r.perfilesPorPersona) * 100) / 100 },
        };
      }

      if (wanted.has("favoritos")) {
        const [tot, top] = await Promise.all([
          prisma.$queryRaw<{ favoritos: number; usuarios: number; perfiles: number }[]>`
            SELECT COUNT(*)::int AS favoritos, COUNT(DISTINCT fv."userId")::int AS usuarios, COUNT(DISTINCT fv."professionalId")::int AS perfiles
            FROM "Favorite" fv WHERE fv."createdAt" >= ${period.from} AND fv."createdAt" < ${period.to} AND fv."userId" NOT IN ${staffIdsSql()}`,
          prisma.$queryRaw<{ username: string; nombre: string | null; ciudad: string | null; tier: string | null; favoritos: number }[]>`
            SELECT u."username", u."displayName" AS nombre, u."city" AS ciudad, u."tier"::text AS tier, COUNT(*)::int AS favoritos
            FROM "Favorite" fv JOIN "User" u ON u."id" = fv."professionalId"
            WHERE fv."createdAt" >= ${period.from} AND fv."createdAt" < ${period.to} GROUP BY 1,2,3,4 ORDER BY 5 DESC LIMIT ${take}`,
        ]);
        out.favoritos = { ...tot[0], favoritosPorUsuario: tot[0].usuarios ? Math.round((tot[0].favoritos / tot[0].usuarios) * 100) / 100 : null, perfilesMasGuardados: top, nota: "Sólo usuarios registrados pueden guardar favoritos." };
      }

      if (wanted.has("retencion")) {
        // Cohortes por semana de primera visita (últimas 12 semanas hasta el fin del periodo), sólo visitantes con visitorId.
        const rows = await prisma.$queryRaw<{ cohorte: string; visitantes: number; s1: number; s2: number; s4: number; s8: number }[]>`
          WITH first_seen AS (
            SELECT pv."visitorId" AS vid, MIN(pv."createdAt") AS first_at FROM "PageView" pv
            WHERE pv."visitorId" IS NOT NULL AND pv."path" NOT LIKE '/admin%' AND (pv."userAgent" IS NULL OR pv."userAgent" !~* 'bot|crawl|spider|headless|lighthouse')
              AND pv."createdAt" >= ${period.to}::timestamptz - interval '12 weeks' AND pv."createdAt" < ${period.to}
            GROUP BY 1
            HAVING MIN(pv."createdAt") >= ${period.to}::timestamptz - interval '12 weeks'
          ), cohorts AS (
            SELECT vid, first_at, date_trunc('week', (first_at AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}) AS week FROM first_seen
          ), back AS (
            SELECT c.vid, c.week,
              EXISTS (SELECT 1 FROM "PageView" p WHERE p."visitorId" = c.vid AND p."createdAt" >= c.first_at + interval '7 days' AND p."createdAt" < c.first_at + interval '14 days') AS s1,
              EXISTS (SELECT 1 FROM "PageView" p WHERE p."visitorId" = c.vid AND p."createdAt" >= c.first_at + interval '14 days' AND p."createdAt" < c.first_at + interval '21 days') AS s2,
              EXISTS (SELECT 1 FROM "PageView" p WHERE p."visitorId" = c.vid AND p."createdAt" >= c.first_at + interval '28 days' AND p."createdAt" < c.first_at + interval '35 days') AS s4,
              EXISTS (SELECT 1 FROM "PageView" p WHERE p."visitorId" = c.vid AND p."createdAt" >= c.first_at + interval '56 days' AND p."createdAt" < c.first_at + interval '63 days') AS s8
            FROM cohorts c
          )
          SELECT to_char(week, 'YYYY-MM-DD') AS cohorte, COUNT(*)::int AS visitantes,
            COUNT(*) FILTER (WHERE s1)::int AS s1, COUNT(*) FILTER (WHERE s2)::int AS s2, COUNT(*) FILTER (WHERE s4)::int AS s4, COUNT(*) FILTER (WHERE s8)::int AS s8
          FROM back GROUP BY 1 ORDER BY 1`;
        const now = Date.now();
        const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
        out.retencion = {
          cohortes: rows.map((r) => {
            const weekStart = new Date(`${r.cohorte}T12:00:00Z`).getTime();
            const ageDays = (now - weekStart) / 86400000;
            return {
              semanaInicio: r.cohorte,
              visitantesNuevos: r.visitantes,
              semana1Pct: ageDays >= 14 ? pct(r.s1, r.visitantes) : null,
              semana2Pct: ageDays >= 21 ? pct(r.s2, r.visitantes) : null,
              semana4Pct: ageDays >= 35 ? pct(r.s4, r.visitantes) : null,
              semana8Pct: ageDays >= 63 ? pct(r.s8, r.visitantes) : null,
            };
          }),
          criterio: "Cohorte = semana (lunes, Chile) de la primera visita del navegador. 'Vuelve en la semana N' = tuvo alguna vista entre los días 7N y 7N+6 después de la primera. null = la cohorte aún no cumple esa edad.",
          grafico: "tabla de cohortes con escala de color",
        };
      }

      return jsonResult(out);
    }),
  );
}
