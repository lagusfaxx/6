import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../db";
import { config } from "../../config";
import { normalizeCity } from "../../lib/chileGeo";
import {
  GscError,
  inspectUrl,
  listSitemaps,
  searchAnalytics,
  searchConsoleConfigured,
  searchConsoleSite,
  type GscDimension,
  type GscFilter,
  type GscRow,
} from "../../lib/searchConsole";
import { realUserSql } from "../../lib/statsFilters";
import { guarded, type McpContext } from "../audit";
import { chileToday, deltaPct, errorResult, findUserRef, jsonResult, periodShape, resolvePeriod, type PeriodInput, type ToolResult } from "../helpers";

const READ = { readOnlyHint: true, openWorldHint: true } as const;

const DIMENSIONES = { consulta: "query", pagina: "page", pais: "country", dispositivo: "device", fecha: "date", apariencia: "searchAppearance" } as const;
type Dimension = keyof typeof DIMENSIONES;
const DISPOSITIVOS = { movil: "MOBILE", desktop: "DESKTOP", tablet: "TABLET" } as const;
const ORDEN = ["clics", "impresiones", "ctr", "posicion"] as const;
const TIPOS = ["web", "image", "video", "news", "discover", "googleNews"] as const;

const CRITERIOS =
  "Datos de Google Search Console (búsqueda orgánica de Google, no incluye Ads). Google entrega los días en hora del Pacífico y con 2-3 días de atraso: los últimos días pueden venir incompletos (se piden con dataState=all). " +
  "Posición = posición media (1 = primer resultado). CTR = clics / impresiones. Las consultas muy poco frecuentes Google las oculta por privacidad, así que la suma por consulta es menor que el total.";

/** CTR esperado aproximado por posición orgánica (curvas públicas de la industria). */
const CTR_ESPERADO = [0, 0.28, 0.15, 0.11, 0.08, 0.07, 0.05, 0.04, 0.03, 0.03, 0.025];

function ymd(d: Date): string {
  return chileToday(d);
}

function rangeOf(args: PeriodInput) {
  const p = resolvePeriod({ periodo: "30d", ...args });
  return {
    actual: { startDate: ymd(p.from), endDate: ymd(new Date(p.to.getTime() - 1)) },
    anterior: { startDate: ymd(p.previous.from), endDate: ymd(new Date(p.previous.to.getTime() - 1)) },
    label: p.label,
    anteriorLabel: p.previous.label,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const fmtRow = (r: GscRow) => ({ clics: r.clicks, impresiones: r.impressions, ctrPct: r1(r.ctr * 100), posicion: r1(r.position) });

function withGsc<A>(handler: (args: A) => Promise<ToolResult>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return await handler(args);
    } catch (err) {
      // Los errores de Google son mostrables (permisos, cuota, parámetros) y no traen secretos.
      if (err instanceof GscError) return errorResult(err.message);
      throw err;
    }
  };
}

async function profilePath(usuario: string): Promise<string | null> {
  const id = await findUserRef(usuario);
  return id ? `/profesional/${id}` : null;
}

function absoluteUrl(u: string): string {
  if (/^https?:\/\//i.test(u)) return u;
  return `${config.appUrl.replace(/\/$/, "")}${u.startsWith("/") ? "" : "/"}${u}`;
}

export function registerSearchConsoleTools(server: McpServer, ctx: McpContext) {
  if (!searchConsoleConfigured()) return;

  server.registerTool(
    "search_console",
    {
      title: "Google Search Console: rendimiento",
      description:
        "Tráfico orgánico de Google hacia uzeed.cl: clics, impresiones, CTR y posición media, totales y agrupados por consulta, página, país, dispositivo, fecha o apariencia, " +
        "comparados con el periodo anterior. Filtros: consulta (contiene), pagina (contiene), usuario (la ficha de un perfil), pais (ISO-3, ej. chl), dispositivo, sinMarca (excluye búsquedas que dicen uzeed). " +
        "Para ideas de mejora usa search_console_oportunidades; para indexación, search_console_indexacion.",
      inputSchema: {
        ...periodShape,
        agruparPor: z.array(z.enum(Object.keys(DIMENSIONES) as [Dimension, ...Dimension[]])).max(3).optional().describe("Vacío = sólo totales."),
        consulta: z.string().max(200).optional(),
        pagina: z.string().max(300).optional().describe("Parte de la URL, ej. /escorts o /profesional/."),
        usuario: z.string().optional().describe("id, username o email: filtra la ficha de ese perfil."),
        pais: z.string().regex(/^[a-zA-Z]{3}$/).optional(),
        dispositivo: z.enum(["movil", "desktop", "tablet"]).optional(),
        sinMarca: z.boolean().optional().describe("true = excluye consultas con 'uzeed' (tráfico no de marca)."),
        tipo: z.enum(TIPOS).optional().describe("Por defecto web. discover = Google Discover."),
        orden: z.enum(ORDEN).optional().describe("Por defecto clics."),
        comparar: z.boolean().optional().describe("Por defecto true: agrega el periodo anterior y la variación."),
        limite: z.number().int().min(1).max(500).optional().describe("Filas (por defecto 50)."),
      },
      annotations: READ,
    },
    guarded(
      "search_console",
      ctx,
      withGsc(
        async (args: PeriodInput & {
          agruparPor?: Dimension[];
          consulta?: string;
          pagina?: string;
          usuario?: string;
          pais?: string;
          dispositivo?: keyof typeof DISPOSITIVOS;
          sinMarca?: boolean;
          tipo?: (typeof TIPOS)[number];
          orden?: (typeof ORDEN)[number];
          comparar?: boolean;
          limite?: number;
        }) => {
          const range = rangeOf(args);
          const filters: GscFilter[] = [];
          if (args.consulta) filters.push({ dimension: "query", operator: "contains", expression: args.consulta.toLowerCase() });
          if (args.pagina) filters.push({ dimension: "page", operator: "contains", expression: args.pagina });
          if (args.usuario) {
            const path = await profilePath(args.usuario);
            if (!path) return errorResult(`No encontré al usuario "${args.usuario}".`);
            filters.push({ dimension: "page", operator: "contains", expression: path });
          }
          if (args.pais) filters.push({ dimension: "country", operator: "equals", expression: args.pais.toLowerCase() });
          if (args.dispositivo) filters.push({ dimension: "device", operator: "equals", expression: DISPOSITIVOS[args.dispositivo] });
          if (args.sinMarca) filters.push({ dimension: "query", operator: "notContains", expression: "uzeed" });
          const dims = (args.agruparPor ?? []).map((d) => DIMENSIONES[d]) as GscDimension[];
          const comparar = args.comparar !== false;
          const base = { filters, type: args.tipo ?? "web" };

          const [totAct, totAnt, rowsAct, rowsAnt] = await Promise.all([
            searchAnalytics({ ...range.actual, ...base }),
            comparar ? searchAnalytics({ ...range.anterior, ...base }) : Promise.resolve([] as GscRow[]),
            dims.length ? searchAnalytics({ ...range.actual, ...base, dimensions: dims, rowLimit: 5000 }) : Promise.resolve([] as GscRow[]),
            dims.length && comparar && !dims.includes("date")
              ? searchAnalytics({ ...range.anterior, ...base, dimensions: dims, rowLimit: 5000 })
              : Promise.resolve([] as GscRow[]),
          ]);

          const t = totAct[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
          const tp = totAnt[0];
          const out: Record<string, unknown> = {
            propiedad: searchConsoleSite(),
            periodo: range.label,
            periodoAnterior: comparar ? range.anteriorLabel : undefined,
            totales: {
              ...fmtRow(t),
              ...(tp
                ? {
                    anterior: fmtRow(tp),
                    variacionClicsPct: deltaPct(t.clicks, tp.clicks),
                    variacionImpresionesPct: deltaPct(t.impressions, tp.impressions),
                    variacionPosicion: r1(t.position - tp.position),
                  }
                : {}),
            },
            criterios: CRITERIOS,
          };

          if (dims.length) {
            const prev = new Map(rowsAnt.map((r) => [(r.keys ?? []).join("|"), r]));
            const key: Record<(typeof ORDEN)[number], (r: GscRow) => number> = {
              clics: (r) => r.clicks,
              impresiones: (r) => r.impressions,
              ctr: (r) => r.ctr,
              posicion: (r) => -r.position,
            };
            const orden = args.orden ?? "clics";
            const sorted = dims.includes("date")
              ? [...rowsAct].sort((a, b) => String(a.keys?.[0]).localeCompare(String(b.keys?.[0])))
              : [...rowsAct].sort((a, b) => key[orden](b) - key[orden](a));
            const names = args.agruparPor!;
            out.filas = sorted.slice(0, args.limite ?? 50).map((r) => {
              const p = prev.get((r.keys ?? []).join("|"));
              return {
                ...Object.fromEntries(names.map((n, i) => [n, r.keys?.[i]])),
                ...fmtRow(r),
                ...(comparar && !dims.includes("date")
                  ? { clicsAnterior: p?.clicks ?? 0, variacionClicsPct: deltaPct(r.clicks, p?.clicks ?? 0), posicionAnterior: p ? r1(p.position) : null }
                  : {}),
              };
            });
            out.filasTotales = rowsAct.length;
            out.grafico = dims.includes("date") ? "línea de clics e impresiones por día" : "tabla ordenable o barras";
          }
          return jsonResult(out);
        },
      ),
    ),
  );

  server.registerTool(
    "search_console_oportunidades",
    {
      title: "Google Search Console: oportunidades SEO",
      description:
        "Ideas priorizadas a partir de Search Console, cruzadas con la oferta de UZEED. Secciones: " +
        "casi_primera_pagina (consultas en posición 4-20 con muchas impresiones: subirlas trae más clics); " +
        "ctr_bajo (en top 10 pero con CTR bajo lo esperado para su posición: mejorar título y descripción); " +
        "en_caida (páginas que más clics perdieron vs el periodo anterior); " +
        "canibalizacion (consultas donde compiten 2+ páginas de uzeed); " +
        "demanda_por_zona (búsquedas en Google que nombran una comuna vs perfiles publicados en esa ciudad: dónde hay demanda sin oferta).",
      inputSchema: {
        ...periodShape,
        secciones: z
          .array(z.enum(["casi_primera_pagina", "ctr_bajo", "en_caida", "canibalizacion", "demanda_por_zona"]))
          .optional(),
        impresionesMinimas: z.number().int().min(1).optional().describe("Umbral para considerar una consulta (por defecto 50)."),
        sinMarca: z.boolean().optional().describe("Por defecto true: ignora consultas con 'uzeed'."),
        limite: z.number().int().min(1).max(100).optional().describe("Filas por sección (por defecto 20)."),
      },
      annotations: READ,
    },
    guarded(
      "search_console_oportunidades",
      ctx,
      withGsc(
        async (args: PeriodInput & {
          secciones?: ("casi_primera_pagina" | "ctr_bajo" | "en_caida" | "canibalizacion" | "demanda_por_zona")[];
          impresionesMinimas?: number;
          sinMarca?: boolean;
          limite?: number;
        }) => {
          const range = rangeOf(args);
          const wanted = new Set(args.secciones?.length ? args.secciones : ["casi_primera_pagina", "ctr_bajo", "en_caida", "canibalizacion", "demanda_por_zona"]);
          const min = args.impresionesMinimas ?? 50;
          const take = args.limite ?? 20;
          const filters: GscFilter[] = args.sinMarca === false ? [] : [{ dimension: "query", operator: "notContains", expression: "uzeed" }];
          const out: Record<string, unknown> = { propiedad: searchConsoleSite(), periodo: range.label, criterios: CRITERIOS };

          const needQueries = wanted.has("casi_primera_pagina") || wanted.has("ctr_bajo") || wanted.has("demanda_por_zona");
          const queries = needQueries ? await searchAnalytics({ ...range.actual, filters, dimensions: ["query"], rowLimit: 25000 }) : [];

          if (wanted.has("casi_primera_pagina")) {
            out.casi_primera_pagina = queries
              .filter((r) => r.position >= 4 && r.position <= 20 && r.impressions >= min)
              .sort((a, b) => b.impressions - a.impressions)
              .slice(0, take)
              .map((r) => ({
                consulta: r.keys?.[0],
                ...fmtRow(r),
                clicsPotencialesTop3: Math.round(r.impressions * CTR_ESPERADO[3]) - r.clicks,
              }));
          }

          if (wanted.has("ctr_bajo")) {
            out.ctr_bajo = queries
              .filter((r) => r.position <= 10 && r.impressions >= min)
              .map((r) => {
                const esperado = CTR_ESPERADO[Math.max(1, Math.round(r.position))];
                return { r, esperado, perdidos: Math.round(r.impressions * (esperado - r.ctr)) };
              })
              .filter((x) => x.r.ctr < x.esperado * 0.6)
              .sort((a, b) => b.perdidos - a.perdidos)
              .slice(0, take)
              .map((x) => ({ consulta: x.r.keys?.[0], ...fmtRow(x.r), ctrEsperadoPct: r1(x.esperado * 100), clicsPerdidosAprox: x.perdidos }));
          }

          if (wanted.has("en_caida")) {
            const [act, ant] = await Promise.all([
              searchAnalytics({ ...range.actual, filters, dimensions: ["page"], rowLimit: 5000 }),
              searchAnalytics({ ...range.anterior, filters, dimensions: ["page"], rowLimit: 5000 }),
            ]);
            const now = new Map(act.map((r) => [r.keys?.[0] ?? "", r]));
            out.en_caida = {
              periodoAnterior: range.anteriorLabel,
              paginas: ant
                .map((p) => {
                  const c = now.get(p.keys?.[0] ?? "");
                  return { pagina: p.keys?.[0], clicsAntes: p.clicks, clicsAhora: c?.clicks ?? 0, perdidos: p.clicks - (c?.clicks ?? 0), posicionAntes: r1(p.position), posicionAhora: c ? r1(c.position) : null };
                })
                .filter((x) => x.perdidos > 0)
                .sort((a, b) => b.perdidos - a.perdidos)
                .slice(0, take),
            };
          }

          if (wanted.has("canibalizacion")) {
            const rows = await searchAnalytics({ ...range.actual, filters, dimensions: ["query", "page"], rowLimit: 25000 });
            const byQuery = new Map<string, GscRow[]>();
            for (const r of rows) {
              const q = r.keys?.[0] ?? "";
              byQuery.set(q, [...(byQuery.get(q) ?? []), r]);
            }
            out.canibalizacion = [...byQuery.entries()]
              .map(([consulta, pages]) => ({ consulta, pages: pages.filter((p) => p.impressions >= Math.max(10, min / 5)) }))
              .filter((x) => x.pages.length >= 2)
              .map((x) => {
                const imp = x.pages.reduce((a, p) => a + p.impressions, 0);
                return {
                  consulta: x.consulta,
                  impresiones: imp,
                  paginas: x.pages
                    .sort((a, b) => b.impressions - a.impressions)
                    .slice(0, 5)
                    .map((p) => ({ pagina: p.keys?.[1], impresiones: p.impressions, clics: p.clicks, posicion: r1(p.position), pctImpresiones: r1((p.impressions / imp) * 100) })),
                };
              })
              .sort((a, b) => b.impresiones - a.impresiones)
              .slice(0, take);
          }

          if (wanted.has("demanda_por_zona")) {
            const demanda = new Map<string, { ciudad: string; region: string; impresiones: number; clics: number; consultas: number; ejemplo: string }>();
            for (const r of queries) {
              const g = normalizeCity(r.keys?.[0] ?? "");
              if (g.sinNormalizar) continue;
              const d = demanda.get(g.ciudad) ?? { ciudad: g.ciudad, region: g.region, impresiones: 0, clics: 0, consultas: 0, ejemplo: r.keys?.[0] ?? "" };
              d.impresiones += r.impressions;
              d.clics += r.clicks;
              d.consultas += 1;
              demanda.set(g.ciudad, d);
            }
            const oferta = await prisma.$queryRaw<{ city: string | null; n: number }[]>`
              SELECT u."city", COUNT(*)::int AS n FROM "User" u
              WHERE u."profileType" IN ('PROFESSIONAL', 'ESTABLISHMENT') AND u."isActive" AND u."isVerified" AND ${realUserSql("u")}
              GROUP BY 1`;
            const perfiles = new Map<string, number>();
            for (const o of oferta) {
              const c = normalizeCity(o.city).ciudad;
              perfiles.set(c, (perfiles.get(c) ?? 0) + o.n);
            }
            out.demanda_por_zona = {
              nota: "Consultas de Google que nombran una comuna, agrupadas por ciudad (Gran Santiago = Santiago), contra perfiles publicados (profesionales y establecimientos). Muchas impresiones por perfil = demanda sin oferta suficiente.",
              zonas: [...demanda.values()]
                .map((d) => {
                  const p = perfiles.get(d.ciudad) ?? 0;
                  return { ...d, perfilesPublicados: p, impresionesPorPerfil: p ? Math.round(d.impresiones / p) : null, sinOferta: p === 0 };
                })
                .sort((a, b) => b.impresiones - a.impresiones)
                .slice(0, take),
              grafico: "mapa/semáforo por ciudad o dispersión impresiones vs perfiles",
            };
          }

          return jsonResult(out);
        },
      ),
    ),
  );

  server.registerTool(
    "search_console_indexacion",
    {
      title: "Google Search Console: indexación",
      description:
        "Estado de los sitemaps (enviados, errores, advertencias, última lectura) y, si se piden, inspección de URLs: si Google la tiene indexada, la última vez que la rastreó, la canónica que eligió, problemas de móvil y de datos estructurados. " +
        "urls acepta rutas (/escorts) o URLs completas; usuario inspecciona la ficha de ese perfil. Máximo 10 URLs por llamada (Google limita a 2.000 inspecciones por día).",
      inputSchema: {
        urls: z.array(z.string().max(500)).max(10).optional(),
        usuario: z.string().optional().describe("id, username o email: inspecciona su ficha."),
        sitemaps: z.boolean().optional().describe("Por defecto true."),
      },
      annotations: READ,
    },
    guarded(
      "search_console_indexacion",
      ctx,
      withGsc(async ({ urls, usuario, sitemaps }: { urls?: string[]; usuario?: string; sitemaps?: boolean }) => {
        const targets = (urls ?? []).map(absoluteUrl);
        if (usuario) {
          const path = await profilePath(usuario);
          if (!path) return errorResult(`No encontré al usuario "${usuario}".`);
          targets.push(absoluteUrl(path));
        }
        if (targets.length > 10) return errorResult("Máximo 10 URLs por llamada.");
        const out: Record<string, unknown> = { propiedad: searchConsoleSite() };
        if (sitemaps !== false) {
          const list = await listSitemaps();
          out.sitemaps = list.map((s) => ({
            sitemap: s.path,
            ultimaLectura: s.lastDownloaded ?? null,
            enviado: s.lastSubmitted ?? null,
            pendiente: s.isPending ?? false,
            errores: Number(s.errors ?? 0),
            advertencias: Number(s.warnings ?? 0),
            urlsEnviadas: (s.contents ?? []).reduce((a: number, c: any) => a + Number(c.submitted ?? 0), 0),
          }));
        }
        if (targets.length) {
          out.urls = [];
          for (const url of targets) {
            const r = await inspectUrl(url);
            const idx = r?.indexStatusResult ?? {};
            (out.urls as unknown[]).push({
              url,
              veredicto: idx.verdict ?? null,
              estado: idx.coverageState ?? null,
              indexable: idx.indexingState ?? null,
              robots: idx.robotsTxtState ?? null,
              ultimoRastreo: idx.lastCrawlTime ?? null,
              canonicaGoogle: idx.googleCanonical ?? null,
              canonicaDeclarada: idx.userCanonical ?? null,
              rastreadoComo: idx.crawledAs ?? null,
              movil: r?.mobileUsabilityResult?.verdict ?? null,
              datosEstructurados: (r?.richResultsResult?.detectedItems ?? []).map((i: any) => i.richResultType),
              informe: r?.inspectionResultLink ?? null,
            });
          }
        }
        return jsonResult(out);
      }),
    ),
  );
}
