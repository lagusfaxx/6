import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { normalizeCity } from "../../lib/chileGeo";
import { guarded, type McpContext } from "../audit";
import { TZ, describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { localTs } from "../metrics";
import {
  contactKeySql,
  describeFiltros,
  filtrosShape,
  hasProfileFilters,
  pickFiltros,
  profilePathJoin,
  profileSql,
  trafficCtes,
  withSegment,
  type Filtros,
} from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

const SECCIONES = ["volumen", "fuentes", "paginas", "heatmap", "busquedas", "dispositivos", "usuarios", "ubicacion", "acciones"] as const;

export function registerTrafficTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "analitica_trafico",
    {
      title: "Analítica de tráfico web",
      description:
        "Tráfico real del sitio (sin bots, sin el equipo, sin /admin) con filtros comunes (región/ciudad/comuna del visitante, dispositivo, PWA/web, fuente, nuevo/recurrente, registrado/anónimo, y filtros de perfil para las vistas de fichas). Secciones: " +
        "volumen (visitas, visitantes únicos, sesiones, páginas por sesión, duración media y rebote); " +
        "fuentes (orgánico/directo/redes/referidos/ads/campaña por sesión, dominios, campañas UTM); " +
        "paginas (más vistas, landing y salida); heatmap (sesiones por día de la semana × hora, para ver cuándo entra la gente); " +
        "busquedas (términos, filtros usados, sin resultados); dispositivos (móvil/desktop/tablet, PWA vs web, navegadores); " +
        "usuarios (nuevos vs recurrentes, registrados vs anónimos, frecuencia); ubicacion (región/ciudad normalizada del visitante); acciones (clicks brutos y únicos). Por defecto trae todas.",
      inputSchema: {
        ...periodShape,
        ...filtrosShape,
        secciones: z.array(z.enum(SECCIONES)).optional(),
        limite: z.number().int().min(1).max(100).optional().describe("Filas por ranking (por defecto 20)."),
      },
      annotations: READ,
    },
    guarded("analitica_trafico", ctx, async (args: PeriodInput & Filtros & { secciones?: (typeof SECCIONES)[number][]; limite?: number }) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const wanted = new Set(args.secciones?.length ? args.secciones : SECCIONES);
      const ctes = await trafficCtes(period, f);
      const pf = await profileSql(f, "u");
      const profileFiltered = hasProfileFilters(f);
      const pvScope = profileFiltered ? Prisma.sql`${profilePathJoin("pvf", "u")} WHERE ${pf}` : Prisma.empty;
      const out: Record<string, unknown> = {
        periodo: describePeriod(period),
        filtros: describeFiltros(f),
        criterios: {
          trafico: "Sin bots (user agent), sin el equipo y sin /admin. Visitantes únicos por navegador (visitorId).",
          sesion: "Una sesión = una pestaña (sessionId). Duración = primera a última vista de la sesión; rebote = sesión de una sola vista.",
          fuente: "Se toma de la primera vista de la sesión. ads = utm_medium pagado; campaña = cualquier UTM; orgánico = buscadores; redes = redes sociales; directo = sin referente o interno.",
          nuevo: "Visitante cuya primera vista registrada cae dentro del periodo.",
        },
      };

      const q = <T>(sql: Prisma.Sql) => prisma.$queryRaw<T[]>`${ctes} ${sql}`;

      if (wanted.has("volumen")) {
        const [r] = await q<Record<string, number>>(Prisma.sql`
          SELECT
            (SELECT COUNT(*) FROM pvf ${pvScope})::int AS visitas,
            (SELECT COUNT(DISTINCT pvf.vkey) FROM pvf ${pvScope})::int AS visitantes,
            (SELECT COUNT(*) FROM fs)::int AS sesiones,
            (SELECT COALESCE(AVG(pages), 0) FROM fs)::float8 AS paginas_por_sesion,
            (SELECT COALESCE(AVG(seconds) FILTER (WHERE pages > 1), 0) FROM fs)::float8 AS duracion_media_s,
            (SELECT COUNT(*) FILTER (WHERE pages = 1) FROM fs)::int AS rebotes,
            (SELECT COUNT(*) FROM pvf WHERE pvf."path" LIKE '/profesional/%')::int AS vistas_fichas,
            (SELECT COALESCE(AVG(profiles_seen), 0) FROM fs)::float8 AS fichas_por_sesion`);
        out.volumen = {
          visitas: r.visitas,
          visitantesUnicos: r.visitantes,
          sesiones: r.sesiones,
          paginasPorSesion: Math.round(Number(r.paginas_por_sesion) * 10) / 10,
          duracionMediaSegundos: Math.round(Number(r.duracion_media_s)),
          rebotePct: r.sesiones ? Math.round((r.rebotes / r.sesiones) * 1000) / 10 : null,
          vistasFichas: r.vistas_fichas,
          fichasVistasPorSesion: Math.round(Number(r.fichas_por_sesion) * 10) / 10,
          grafico: "línea temporal (usa serie_temporal con visitas o visitantes_unicos)",
        };
      }

      if (wanted.has("fuentes")) {
        const [porFuente, dominios, campanas] = await Promise.all([
          q<{ fuente: string; sesiones: number; visitantes: number; contactos: number }>(Prisma.sql`
            SELECT fs.fuente, COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes,
              (SELECT COUNT(DISTINCT ${contactKeySql("uaf")}) FROM uaf JOIN fs f2 ON COALESCE(uaf."sessionId", '') = f2.skey
                WHERE f2.fuente = fs.fuente AND uaf."action" IN ('whatsapp_click','phone_click'))::int AS contactos
            FROM fs GROUP BY 1 ORDER BY 2 DESC`),
          q<{ dominio: string; sesiones: number }>(Prisma.sql`
            SELECT COALESCE(substring(fs."referrer" from '^(?:https?://)?(?:www[.])?([^/:?#]+)'), '(directo)') AS dominio, COUNT(*)::int AS sesiones
            FROM fs WHERE fs.fuente IN ('organico','redes','referidos') GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`),
          q<{ campana: string; fuente: string; medio: string; sesiones: number; visitantes: number }>(Prisma.sql`
            SELECT COALESCE(fs."utmCampaign", '(sin campaña)') AS campana, COALESCE(fs."utmSource", '') AS fuente, COALESCE(fs."utmMedium", '') AS medio,
              COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes
            FROM fs WHERE fs."utmSource" IS NOT NULL OR fs."utmCampaign" IS NOT NULL
            GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT ${take}`),
        ]);
        out.fuentes = { porFuente, dominios, campanasUtm: campanas, grafico: "dona por fuente" };
      }

      if (wanted.has("paginas")) {
        const [masVistas, landings, salidas] = await Promise.all([
          q<{ ruta: string; visitas: number; visitantes: number }>(Prisma.sql`
            SELECT pvf."path" AS ruta, COUNT(*)::int AS visitas, COUNT(DISTINCT pvf.vkey)::int AS visitantes
            FROM pvf ${pvScope} GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`),
          q<{ pagina: string; entradas: number; rebotePct: number }>(Prisma.sql`
            SELECT fs.landing AS pagina, COUNT(*)::int AS entradas,
              ROUND(100.0 * COUNT(*) FILTER (WHERE pages = 1) / COUNT(*), 1)::float8 AS "rebotePct"
            FROM fs GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`),
          q<{ pagina: string; salidas: number }>(Prisma.sql`
            SELECT fs.exit_path AS pagina, COUNT(*)::int AS salidas FROM fs GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`),
        ]);
        out.paginas = { masVistas, paginasDeEntrada: landings, paginasDeSalida: salidas };
      }

      if (wanted.has("heatmap")) {
        const rows = await q<{ dow: number; hora: number; sesiones: number }>(Prisma.sql`
          SELECT EXTRACT(ISODOW FROM ${localTs("fs.started")})::int AS dow, EXTRACT(HOUR FROM ${localTs("fs.started")})::int AS hora, COUNT(*)::int AS sesiones
          FROM fs GROUP BY 1,2 ORDER BY 1,2`);
        const dias = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
        const matriz = dias.map(() => Array(24).fill(0));
        for (const r of rows) matriz[r.dow - 1][r.hora] = r.sesiones;
        const best = rows.slice().sort((a, b) => b.sesiones - a.sesiones).slice(0, 5).map((r) => ({ dia: dias[r.dow - 1], hora: r.hora, sesiones: r.sesiones }));
        out.heatmap = { filas: dias, columnas: "hora 0-23 (Chile)", matriz, picos: best, grafico: "heatmap semanal día × hora" };
      }

      if (wanted.has("busquedas")) {
        const created = Prisma.sql`sl."createdAt" >= ${period.from} AND sl."createdAt" < ${period.to}`;
        const [terminos, sinResultados, filtros, porCiudad, totales] = await Promise.all([
          prisma.$queryRaw<{ termino: string; busquedas: number; resultadosPromedio: number }[]>`
            SELECT lower(sl."q") AS termino, COUNT(*)::int AS busquedas, ROUND(AVG(sl."resultCount"))::int AS "resultadosPromedio"
            FROM "SearchLog" sl WHERE ${created} AND sl."q" IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT ${take}`,
          prisma.$queryRaw<{ termino: string; ciudad: string | null; categoria: string | null; veces: number }[]>`
            SELECT COALESCE(lower(sl."q"), '(sin término)') AS termino, sl."city" AS ciudad, sl."categorySlug" AS categoria, COUNT(*)::int AS veces
            FROM "SearchLog" sl WHERE ${created} AND sl."resultCount" = 0 GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT ${take}`,
          prisma.$queryRaw<{ filtro: string; valor: string; veces: number }[]>`
            SELECT kv.key AS filtro, left(kv.value::text, 60) AS valor, COUNT(*)::int AS veces
            FROM "SearchLog" sl, jsonb_each(COALESCE(sl."filters", '{}'::jsonb)) kv
            WHERE ${created} GROUP BY 1,2 ORDER BY 3 DESC LIMIT ${take}`,
          prisma.$queryRaw<{ ciudad: string; categoria: string | null; busquedas: number; sinResultados: number }[]>`
            SELECT COALESCE(sl."city", '(sin ciudad)') AS ciudad, sl."categorySlug" AS categoria, COUNT(*)::int AS busquedas,
              COUNT(*) FILTER (WHERE sl."resultCount" = 0)::int AS "sinResultados"
            FROM "SearchLog" sl WHERE ${created} GROUP BY 1,2 ORDER BY 3 DESC LIMIT ${take}`,
          prisma.$queryRaw<{ total: number; sin: number }[]>`
            SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE "resultCount" = 0)::int AS sin FROM "SearchLog" sl WHERE ${created}`,
        ]);
        out.busquedas = {
          total: totales[0]?.total ?? 0,
          sinResultados: totales[0]?.sin ?? 0,
          terminos,
          busquedasSinResultados: sinResultados,
          filtrosMasUsados: filtros,
          porCiudadYCategoria: porCiudad,
          nota: "Sólo búsquedas con término o filtros explícitos; los listados sin filtro no cuentan.",
        };
      }

      if (wanted.has("dispositivos")) {
        const [dispositivos, modo, navegadores] = await Promise.all([
          q<{ dispositivo: string; sesiones: number; visitantes: number }>(Prisma.sql`
            SELECT COALESCE(fs.device, '(desconocido)') AS dispositivo, COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes FROM fs GROUP BY 1 ORDER BY 2 DESC`),
          q<{ modo: string; sesiones: number; visitantes: number }>(Prisma.sql`
            SELECT CASE WHEN fs."displayMode" = 'pwa' THEN 'pwa' ELSE 'web' END AS modo, COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes FROM fs GROUP BY 1 ORDER BY 2 DESC`),
          q<{ navegador: string; sesiones: number }>(Prisma.sql`
            SELECT CASE
              WHEN fs."userAgent" ~* 'edg/' THEN 'Edge'
              WHEN fs."userAgent" ~* 'opr/|opera' THEN 'Opera'
              WHEN fs."userAgent" ~* 'samsungbrowser' THEN 'Samsung Internet'
              WHEN fs."userAgent" ~* 'firefox|fxios' THEN 'Firefox'
              WHEN fs."userAgent" ~* 'chrome|crios' THEN 'Chrome'
              WHEN fs."userAgent" ~* 'safari' THEN 'Safari'
              WHEN fs."userAgent" IS NULL THEN '(desconocido)'
              ELSE 'Otro' END AS navegador, COUNT(*)::int AS sesiones FROM fs GROUP BY 1 ORDER BY 2 DESC`),
        ]);
        const pwaVisitantes = modo.find((m) => m.modo === "pwa")?.visitantes ?? 0;
        out.dispositivos = { dispositivos, pwaVsWeb: modo, instalacionesPwaAprox: pwaVisitantes, navegadores, grafico: "dona por dispositivo",
          nota: "Instalaciones PWA ≈ visitantes distintos que entraron con la app instalada en el periodo." };
      }

      if (wanted.has("usuarios")) {
        const [tipo, sesion, frecuencia] = await Promise.all([
          q<{ tipo: string; sesiones: number; visitantes: number; contactos: number }>(Prisma.sql`
            SELECT CASE WHEN fs.nuevo THEN 'nuevo' ELSE 'recurrente' END AS tipo, COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes,
              (SELECT COUNT(DISTINCT ${contactKeySql("uaf")}) FROM uaf JOIN fs f2 ON COALESCE(uaf."sessionId", '') = f2.skey WHERE f2.nuevo = fs.nuevo AND uaf."action" IN ('whatsapp_click','phone_click'))::int AS contactos
            FROM fs GROUP BY fs.nuevo ORDER BY 1`),
          q<{ tipo: string; sesiones: number; visitantes: number }>(Prisma.sql`
            SELECT CASE WHEN fs."userId" IS NOT NULL THEN 'registrado' ELSE 'anonimo' END AS tipo, COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes FROM fs GROUP BY 1`),
          q<{ sesiones: number; visitantes: number }>(Prisma.sql`
            SELECT LEAST(n, 10)::int AS sesiones, COUNT(*)::int AS visitantes FROM (SELECT vkey, COUNT(*) AS n FROM fs GROUP BY 1) t GROUP BY 1 ORDER BY 1`),
        ]);
        out.usuarios = { nuevosVsRecurrentes: tipo, registradosVsAnonimos: sesion, frecuenciaSesionesPorVisitante: frecuencia.map((r) => ({ sesiones: r.sesiones === 10 ? "10+" : r.sesiones, visitantes: r.visitantes })) };
      }

      if (wanted.has("ubicacion")) {
        const rows = await q<{ ciudad: string | null; pais: string | null; sesiones: number; visitantes: number }>(Prisma.sql`
          SELECT fs.vcity AS ciudad, (SELECT pv."country" FROM "PageView" pv WHERE ${Prisma.raw('COALESCE(pv."sessionId", pv."id"::text)')} = fs.skey LIMIT 1) AS pais,
            COUNT(*)::int AS sesiones, COUNT(DISTINCT fs.vkey)::int AS visitantes
          FROM fs GROUP BY 1,2 ORDER BY 3 DESC LIMIT 500`);
        const porRegion = new Map<string, { sesiones: number; visitantes: number }>();
        const porCiudad = new Map<string, { region: string; sesiones: number; visitantes: number }>();
        const porComuna = new Map<string, { ciudad: string; region: string; sesiones: number; visitantes: number }>();
        let extranjero = 0;
        for (const r of rows) {
          if (r.pais && r.pais !== "CL") { extranjero += r.sesiones; continue; }
          const g = normalizeCity(r.ciudad);
          const reg = porRegion.get(g.region) ?? { sesiones: 0, visitantes: 0 };
          reg.sesiones += r.sesiones; reg.visitantes += r.visitantes; porRegion.set(g.region, reg);
          const c = porCiudad.get(g.ciudad) ?? { region: g.region, sesiones: 0, visitantes: 0 };
          c.sesiones += r.sesiones; c.visitantes += r.visitantes; porCiudad.set(g.ciudad, c);
          const cm = porComuna.get(g.comuna) ?? { ciudad: g.ciudad, region: g.region, sesiones: 0, visitantes: 0 };
          cm.sesiones += r.sesiones; cm.visitantes += r.visitantes; porComuna.set(g.comuna, cm);
        }
        const sortDesc = <T extends { sesiones: number }>(m: Map<string, T>, key: string) =>
          [...m.entries()].map(([k, v]) => ({ [key]: k, ...v })).sort((a, b) => b.sesiones - a.sesiones).slice(0, take);
        out.ubicacion = {
          regiones: sortDesc(porRegion, "region"),
          ciudades: sortDesc(porCiudad, "ciudad"),
          comunas: sortDesc(porComuna, "comuna"),
          sesionesExtranjero: extranjero,
          nota: "Ubicación del visitante según la red (cabeceras del CDN), normalizada a comuna/ciudad/región de Chile.",
          grafico: "mapa por región o barras",
        };
      }

      if (wanted.has("acciones")) {
        const rows = await q<{ accion: string; total: number; unicas: number }>(Prisma.sql`
          SELECT uaf."action" AS accion, COUNT(*)::int AS total, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS unicas FROM uaf GROUP BY 1 ORDER BY 2 DESC`);
        out.acciones = rows;
      }

      return jsonResult(out);
    }),
  );
}
