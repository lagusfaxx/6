import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { normalizeCity, type GeoNormalized } from "../../lib/chileGeo";
import { realUserSql } from "../../lib/statsFilters";
import { guarded, type McpContext } from "../audit";
import { describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";
import { contactKeySql, describeFiltros, filtrosShape, hasProfileFilters, pickFiltros, profileSql, trafficCtes, withSegment, type Filtros } from "../stats/core";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const SECCIONES = ["origen", "flujo", "busquedas", "registrados", "extranjero"] as const;
const NIVELES = ["region", "ciudad", "comuna"] as const;
type Nivel = (typeof NIVELES)[number];

const CONTACT_ACTIONS = Prisma.sql`('whatsapp_click','phone_click')`;

function zona(raw: string | null, pais: string | null, nivel: Nivel): string {
  if (pais && pais !== "CL") return `(extranjero: ${pais})`;
  const g: GeoNormalized = normalizeCity(raw);
  return g[nivel];
}

function pct(a: number, b: number): number | null {
  return b ? Math.round((a / b) * 1000) / 10 : null;
}

/** Suma filas crudas (ciudad tal como llegó) en la zona normalizada del nivel pedido. */
function sumBy<T extends Record<string, unknown>>(rows: T[], keyOf: (r: T) => string, fields: (keyof T)[]) {
  const out = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const k = keyOf(r);
    const acc = out.get(k) ?? Object.fromEntries(fields.map((f) => [f, 0]));
    for (const f of fields) acc[f as string] += Number(r[f] ?? 0);
    out.set(k, acc);
  }
  return out;
}

export function registerLocationTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "ubicacion_clientes",
    {
      title: "Ubicación de los clientes",
      description:
        "De dónde son los clientes (demanda), a nivel región, ciudad o comuna normalizadas. Secciones: origen (visitantes, los que vieron fichas y los que contactaron por zona); " +
        "flujo (zona del cliente → zona del perfil contactado: % local, top orígenes de cada destino); busquedas (zona del visitante vs ciudad que buscó); " +
        "registrados (ciudad declarada de las cuentas cliente); extranjero (visitas y contactos desde fuera de Chile, por país). " +
        "Los filtros geográficos comunes (region/ciudad/comuna) filtran al CLIENTE; para filtrar el perfil contactado usa regionPerfil/ciudadPerfil/comunaPerfil. " +
        "Los filtros de perfil (categoria, tier, tipoPerfil, verificado, estadoPerfil) se aplican al perfil contactado en flujo.",
      inputSchema: {
        ...periodShape,
        ...filtrosShape,
        regionPerfil: z.string().optional(),
        ciudadPerfil: z.string().optional(),
        comunaPerfil: z.string().optional(),
        nivel: z.enum(NIVELES).optional().describe("Agrupación: region, ciudad (por defecto) o comuna."),
        secciones: z.array(z.enum(SECCIONES)).optional(),
        limite: z.number().int().min(1).max(100).optional().describe("Filas por lista (por defecto 20)."),
      },
      annotations: READ,
    },
    guarded(
      "ubicacion_clientes",
      ctx,
      async (
        args: PeriodInput &
          Filtros & {
            regionPerfil?: string;
            ciudadPerfil?: string;
            comunaPerfil?: string;
            nivel?: Nivel;
            secciones?: (typeof SECCIONES)[number][];
            limite?: number;
          },
      ) => {
        const f = await withSegment(pickFiltros(args as Record<string, unknown>));
        const period = resolvePeriod(args);
        const nivel = args.nivel ?? "ciudad";
        const take = args.limite ?? 20;
        const wanted = new Set(args.secciones?.length ? args.secciones : SECCIONES);
        const ctes = await trafficCtes(period, f);
        const sessionCountry = Prisma.sql`, sc AS (SELECT pvf.skey, MAX(pvf."country") AS pais FROM pvf GROUP BY 1)`;
        const q = <T>(sql: Prisma.Sql) => prisma.$queryRaw<T[]>`${ctes} ${sessionCountry} ${sql}`;

        // El perfil contactado: filtros de perfil + su propia geografía.
        const destFiltros: Filtros = {
          categoria: f.categoria,
          tipoPerfil: f.tipoPerfil,
          tier: f.tier,
          verificado: f.verificado,
          estadoPerfil: f.estadoPerfil,
          region: args.regionPerfil,
          ciudad: args.ciudadPerfil,
          comuna: args.comunaPerfil,
        };
        const destWhere = hasProfileFilters(destFiltros) ? Prisma.sql`AND ${await profileSql(destFiltros, "u")}` : Prisma.empty;

        const out: Record<string, unknown> = {
          periodo: describePeriod(period),
          filtrosCliente: describeFiltros(f),
          filtrosPerfil: hasProfileFilters(destFiltros) ? destFiltros : undefined,
          nivel,
          criterios:
            "Ubicación del visitante según la red (cabeceras del CDN) de la primera vista de la sesión, normalizada a comuna/ciudad/región de Chile. " +
            "Contactos = WhatsApp o teléfono, una vez por persona, perfil y día. Sin bots, sin el equipo, sin /admin.",
        };

        const needsOrigin = wanted.has("origen") || wanted.has("extranjero");
        const origen = needsOrigin
          ? await q<{ ciudad: string | null; pais: string | null; visitantes: number; vieronFichas: number; contactaron: number }>(Prisma.sql`
              , con AS (SELECT DISTINCT COALESCE(uaf."sessionId", uaf."id"::text) AS skey, uaf.akey FROM uaf WHERE uaf."action" IN ${CONTACT_ACTIONS})
              SELECT fs.vcity AS ciudad, sc.pais,
                COUNT(DISTINCT fs.vkey)::int AS visitantes,
                COUNT(DISTINCT fs.vkey) FILTER (WHERE fs.profiles_seen > 0)::int AS "vieronFichas",
                COUNT(DISTINCT con.akey)::int AS contactaron
              FROM fs LEFT JOIN sc ON sc.skey = fs.skey LEFT JOIN con ON con.skey = fs.skey
              GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 2000`)
          : [];

        if (wanted.has("origen")) {
          const chile = origen.filter((r) => !r.pais || r.pais === "CL");
          const agg = sumBy(chile, (r) => zona(r.ciudad, r.pais, nivel), ["visitantes", "vieronFichas", "contactaron"]);
          const total = [...agg.values()].reduce((a, v) => a + v.visitantes, 0);
          out.origen = {
            zonas: [...agg.entries()]
              .map(([z, v]) => ({
                [nivel]: z,
                visitantes: v.visitantes,
                pctVisitantes: pct(v.visitantes, total),
                vieronFichas: v.vieronFichas,
                contactaron: v.contactaron,
                tasaContactoPct: pct(v.contactaron, v.visitantes),
              }))
              .sort((a, b) => b.visitantes - a.visitantes)
              .slice(0, take),
            nota: "Los visitantes se suman por zona; una persona que se conectó desde dos zonas cuenta en ambas.",
            grafico: "mapa por región o barras horizontales",
          };
        }

        if (wanted.has("extranjero")) {
          const fuera = origen.filter((r) => r.pais && r.pais !== "CL");
          const agg = sumBy(fuera, (r) => r.pais as string, ["visitantes", "vieronFichas", "contactaron"]);
          const totalAll = origen.reduce((a, r) => a + r.visitantes, 0);
          const totalFuera = fuera.reduce((a, r) => a + r.visitantes, 0);
          out.extranjero = {
            visitantes: totalFuera,
            pctDelTotal: pct(totalFuera, totalAll),
            paises: [...agg.entries()]
              .map(([pais, v]) => ({ pais, visitantes: v.visitantes, vieronFichas: v.vieronFichas, contactaron: v.contactaron }))
              .sort((a, b) => b.visitantes - a.visitantes)
              .slice(0, take),
          };
        }

        if (wanted.has("flujo")) {
          const rows = await q<{ origen: string | null; pais: string | null; destino: string | null; contactos: number }>(Prisma.sql`
            SELECT fs.vcity AS origen, sc.pais, u."city" AS destino, COUNT(DISTINCT ${contactKeySql("uaf")})::int AS contactos
            FROM uaf
            JOIN fs ON COALESCE(uaf."sessionId", uaf."id"::text) = fs.skey
            LEFT JOIN sc ON sc.skey = fs.skey
            JOIN "User" u ON u."id" = uaf."targetId"
            WHERE uaf."action" IN ${CONTACT_ACTIONS} ${destWhere}
            GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 5000`);
          const pares = new Map<string, { origen: string; destino: string; contactos: number }>();
          const porDestino = new Map<string, { total: number; local: number; origenes: Map<string, number> }>();
          let total = 0;
          let local = 0;
          for (const r of rows) {
            const o = zona(r.origen, r.pais, nivel);
            const d = normalizeCity(r.destino)[nivel];
            const key = `${o}→${d}`;
            const p = pares.get(key) ?? { origen: o, destino: d, contactos: 0 };
            p.contactos += r.contactos;
            pares.set(key, p);
            const pd = porDestino.get(d) ?? { total: 0, local: 0, origenes: new Map() };
            pd.total += r.contactos;
            if (o === d) pd.local += r.contactos;
            pd.origenes.set(o, (pd.origenes.get(o) ?? 0) + r.contactos);
            porDestino.set(d, pd);
            total += r.contactos;
            if (o === d) local += r.contactos;
          }
          out.flujo = {
            contactos: total,
            pctMismaZona: pct(local, total),
            pares: [...pares.values()].sort((a, b) => b.contactos - a.contactos).slice(0, take),
            porDestino: [...porDestino.entries()]
              .map(([destino, v]) => ({
                destino,
                contactos: v.total,
                pctLocal: pct(v.local, v.total),
                principalesOrigenes: [...v.origenes.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([origen, contactos]) => ({ origen, contactos, pct: pct(contactos, v.total) })),
              }))
              .sort((a, b) => b.contactos - a.contactos)
              .slice(0, take),
            nota: "Contactos sin ubicación del visitante (sin vistas en la sesión) quedan como '(sin ciudad)'.",
            grafico: "sankey origen → destino o matriz de calor",
          };
        }

        if (wanted.has("busquedas")) {
          const rows = await q<{ origen: string | null; pais: string | null; buscada: string | null; busquedas: number; visitantes: number }>(Prisma.sql`
            SELECT fs.vcity AS origen, sc.pais, sl."city" AS buscada, COUNT(*)::int AS busquedas, COUNT(DISTINCT fs.vkey)::int AS visitantes
            FROM "SearchLog" sl
            JOIN fs ON sl."sessionId" = fs.skey
            LEFT JOIN sc ON sc.skey = fs.skey
            WHERE sl."createdAt" >= ${period.from} AND sl."createdAt" < ${period.to} AND sl."city" IS NOT NULL AND sl."city" <> ''
            GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 5000`);
          const pares = new Map<string, { origen: string; buscada: string; busquedas: number }>();
          let total = 0;
          let otra = 0;
          for (const r of rows) {
            const o = zona(r.origen, r.pais, nivel);
            const b = normalizeCity(r.buscada)[nivel];
            const key = `${o}→${b}`;
            const p = pares.get(key) ?? { origen: o, buscada: b, busquedas: 0 };
            p.busquedas += r.busquedas;
            pares.set(key, p);
            total += r.busquedas;
            if (o !== b) otra += r.busquedas;
          }
          out.busquedas = {
            busquedasConCiudad: total,
            pctBuscaOtraZona: pct(otra, total),
            pares: [...pares.values()].sort((a, b) => b.busquedas - a.busquedas).slice(0, take),
            nota: "Sólo búsquedas con ciudad elegida y sesión identificada. Buscar en otra zona suele indicar viaje o que en su zona no hay oferta.",
          };
        }

        if (wanted.has("registrados")) {
          const rows = await prisma.$queryRaw<{ ciudad: string | null; total: number; nuevas: number }[]>`
            SELECT u."city" AS ciudad, COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE u."createdAt" >= ${period.from} AND u."createdAt" < ${period.to})::int AS nuevas
            FROM "User" u
            WHERE u."profileType" IN ('CLIENT', 'VIEWER') AND ${realUserSql("u")}
            GROUP BY 1`;
          const agg = sumBy(rows, (r) => normalizeCity(r.ciudad)[nivel], ["total", "nuevas"]);
          const total = [...agg.values()].reduce((a, v) => a + v.total, 0);
          out.registrados = {
            cuentasCliente: total,
            zonas: [...agg.entries()]
              .map(([z, v]) => ({ [nivel]: z, cuentas: v.total, pct: pct(v.total, total), nuevasEnPeriodo: v.nuevas }))
              .sort((a, b) => b.cuentas - a.cuentas)
              .slice(0, take),
            nota: "Ciudad que la cuenta declaró (muchas no la llenan: salen como '(sin ciudad)'). Es la base total, no sólo el periodo.",
          };
        }

        return jsonResult(out);
      },
    ),
  );
}
