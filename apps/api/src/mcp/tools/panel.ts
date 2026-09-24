import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { staffIdsSql } from "../../lib/statsFilters";
import { guarded, type McpContext } from "../audit";
import { describePeriod, errorResult, jsonResult, periodShape, resolvePeriod, sanitize, type PeriodInput } from "../helpers";
import { ALERT_KINDS, ALERT_METRICS, ALERT_PERIODS, evaluateAlert, runStatsAlerts } from "../stats/alerts";
import { METRIC_LABELS, contactKeySql, describeFiltros, filtrosShape, hasProfileFilters, pickFiltros, profilePathJoin, profileSql, trafficCtes, withSegment, type Filtros } from "../stats/core";
import { buildWeeklyReport, sendWeeklyReport, setWeeklyConfig, weeklyConfig } from "../stats/weekly";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const ENTIDADES = ["visitas", "sesiones", "contactos", "registros", "perfiles", "pagos", "busquedas", "mensajes", "favoritos", "impresiones"] as const;
type Entidad = (typeof ENTIDADES)[number];

/**
 * Drill-down: las filas detrás de un número. Misma lógica de filtros que las
 * herramientas agregadas, para que el detalle cuadre con el total.
 */
async function detailRows(entidad: Entidad, period: { from: Date; to: Date }, f: Filtros, limit: number, offset: number): Promise<Record<string, unknown>[]> {
  const pf = await profileSql(f, "u");
  const profileFiltered = hasProfileFilters(f);
  const lim = Prisma.sql`LIMIT ${limit} OFFSET ${offset}`;
  switch (entidad) {
    case "visitas": {
      const ctes = await trafficCtes(period, f);
      const join = profileFiltered ? Prisma.sql`${profilePathJoin("pvf", "u")} WHERE ${pf}` : Prisma.empty;
      return prisma.$queryRaw`${ctes} SELECT pvf."createdAt" AS fecha, pvf."path" AS ruta, pvf.fuente, pvf.nuevo, pvf."device" AS dispositivo, pvf."displayMode" AS modo, pvf."city" AS ciudad, pvf."referrer" AS referente, pvf."utmCampaign" AS campana, (pvf."userId" IS NOT NULL) AS registrado, pvf.vkey AS visitante
        FROM pvf ${join} ORDER BY pvf."createdAt" DESC ${lim}`;
    }
    case "sesiones": {
      const ctes = await trafficCtes(period, f);
      return prisma.$queryRaw`${ctes} SELECT fs.started AS inicio, fs.ended AS fin, fs.pages AS paginas, ROUND(fs.seconds)::int AS segundos, fs.landing AS entrada, fs.exit_path AS salida, fs.fuente, fs.nuevo, fs.device AS dispositivo, fs."displayMode" AS modo, fs.vcity AS ciudad, fs."utmCampaign" AS campana, (fs."userId" IS NOT NULL) AS registrado, fs.profiles_seen AS "fichasVistas"
        FROM fs ORDER BY fs.started DESC ${lim}`;
    }
    case "contactos": {
      const ctes = await trafficCtes(period, f);
      return prisma.$queryRaw`${ctes} SELECT uaf."createdAt" AS fecha, uaf."action" AS canal, u."username" AS perfil, u."city" AS ciudad, u."tier"::text AS tier, uaf.fuente, uaf."metadata"->>'source' AS boton, uaf.akey AS persona, ${contactKeySql("uaf")} AS "claveUnica"
        FROM uaf JOIN "User" u ON u."id" = uaf."targetId" AND ${pf} WHERE uaf."action" IN ('whatsapp_click','phone_click') ORDER BY uaf."createdAt" DESC ${lim}`;
    }
    case "registros":
      return prisma.$queryRaw`SELECT u."createdAt" AS fecha, u."username", u."displayName" AS nombre, u."profileType"::text AS tipo, u."city" AS ciudad, u."tier"::text AS tier, u."signupSource" AS origen, u."adminManaged" AS "cargadoPorAdmin", u."isVerified" AS verificado, u."isActive" AS activo, u."verifiedAt" AS "verificadoEl"
        FROM "User" u WHERE ${pf} AND u."createdAt" >= ${period.from} AND u."createdAt" < ${period.to} ORDER BY u."createdAt" DESC ${lim}`;
    case "perfiles":
      return prisma.$queryRaw`SELECT u."username", u."displayName" AS nombre, u."profileType"::text AS tipo, u."city" AS ciudad, u."tier"::text AS tier,
          CASE WHEN u."isActive" AND u."isVerified" THEN 'publicado' WHEN u."isActive" THEN 'pendiente' WHEN u."isVerified" THEN 'oculto' ELSE 'rechazado' END AS estado,
          u."profileViews" AS "vistasHistoricas", u."lastSeen" AS "ultimoLogin", u."lastEditedAt" AS "ultimaEdicion", u."membershipExpiresAt" AS "membresiaHasta", u."createdAt" AS registro
        FROM "User" u WHERE ${pf} AND u."profileType" IN ('PROFESSIONAL','ESTABLISHMENT','SHOP') ORDER BY u."profileViews" DESC ${lim}`;
    case "pagos":
      return prisma.$queryRaw`SELECT pi."paidAt" AS "pagadoEl", pi."createdAt" AS creado, pi."purpose"::text AS proposito, pi."method"::text AS metodo, pi."status"::text AS estado, pi."amount" AS clp, u."username" AS pagador, u."tier"::text AS tier, u."city" AS ciudad
        FROM "PaymentIntent" pi JOIN "User" u ON u."id" = pi."subscriberId" AND ${pf}
        WHERE pi."createdAt" >= ${period.from} AND pi."createdAt" < ${period.to} ORDER BY pi."createdAt" DESC ${lim}`;
    case "busquedas":
      return prisma.$queryRaw`SELECT sl."createdAt" AS fecha, sl."q" AS termino, sl."categorySlug" AS categoria, sl."city" AS ciudad, sl."filters" AS filtros, sl."resultCount" AS resultados, (sl."userId" IS NOT NULL) AS registrado
        FROM "SearchLog" sl WHERE sl."createdAt" >= ${period.from} AND sl."createdAt" < ${period.to} ORDER BY sl."createdAt" DESC ${lim}`;
    case "mensajes":
      return prisma.$queryRaw`SELECT m."createdAt" AS fecha, uf."username" AS de, ut."username" AS para, ut."city" AS ciudad, ut."tier"::text AS tier, (m."readAt" IS NOT NULL) AS leido, length(m."body") AS caracteres
        FROM "Message" m JOIN "User" ut ON ut."id" = m."toId" AND ${pf} JOIN "User" uf ON uf."id" = m."fromId"
        WHERE m."createdAt" >= ${period.from} AND m."createdAt" < ${period.to} AND m."fromId" NOT IN ${staffIdsSql()} ORDER BY m."createdAt" DESC ${lim}`;
    case "favoritos":
      return prisma.$queryRaw`SELECT fv."createdAt" AS fecha, u."username" AS perfil, u."city" AS ciudad, u."tier"::text AS tier, uu."username" AS usuario
        FROM "Favorite" fv JOIN "User" u ON u."id" = fv."professionalId" AND ${pf} JOIN "User" uu ON uu."id" = fv."userId"
        WHERE fv."createdAt" >= ${period.from} AND fv."createdAt" < ${period.to} ORDER BY fv."createdAt" DESC ${lim}`;
    case "impresiones":
      return prisma.$queryRaw`SELECT d."date" AS dia, u."username" AS perfil, u."city" AS ciudad, u."tier"::text AS tier, d."impressions" AS impresiones, ROUND(d."positionSum"::numeric / NULLIF(d."impressions", 0), 1)::float8 AS "posicionMedia"
        FROM "ProfileDailyStats" d JOIN "User" u ON u."id" = d."profileId" AND ${pf}
        WHERE d."date" >= (${period.from}::timestamptz AT TIME ZONE 'America/Santiago')::date AND d."date" <= (${period.to}::timestamptz AT TIME ZONE 'America/Santiago')::date
        ORDER BY d."date" DESC, d."impressions" DESC ${lim}`;
  }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

const detalleShape = {
  entidad: z.enum(ENTIDADES),
  ...periodShape,
  ...filtrosShape,
  limite: z.number().int().min(1).max(2000).optional().describe("Por defecto 200."),
  offset: z.number().int().min(0).optional(),
};
type DetalleArgs = PeriodInput & Filtros & { entidad: Entidad; limite?: number; offset?: number };

export function registerPanelTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "detalle_registros",
    {
      title: "Drill-down: registros detrás de un número",
      description:
        "La lista de filas detrás de cualquier cifra, con los mismos filtros y periodo que la herramienta agregada: visitas, sesiones, contactos, registros, perfiles, pagos, busquedas, mensajes (sin contenido), favoritos o impresiones. Paginado con limite/offset.",
      inputSchema: detalleShape,
      annotations: READ,
    },
    guarded("detalle_registros", ctx, async (args: DetalleArgs) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const rows = await detailRows(args.entidad, period, f, args.limite ?? 200, args.offset ?? 0);
      return jsonResult({ entidad: args.entidad, periodo: describePeriod(period), filtros: describeFiltros(f), mostrando: rows.length, offset: args.offset ?? 0, filas: rows });
    }),
  );

  server.registerTool(
    "exportar_csv",
    {
      title: "Exportar a CSV",
      description: "Lo mismo que detalle_registros pero devuelto como texto CSV (UTF-8, coma, cabecera en la primera fila) listo para guardar como archivo o pegar en una planilla. Hasta 2000 filas por llamada.",
      inputSchema: detalleShape,
      annotations: READ,
    },
    guarded("exportar_csv", ctx, async (args: DetalleArgs) => {
      const f = await withSegment(pickFiltros(args as Record<string, unknown>));
      const period = resolvePeriod(args);
      const rows = (await detailRows(args.entidad, period, f, args.limite ?? 200, args.offset ?? 0)).map((r) => sanitize(r) as Record<string, unknown>);
      return { content: [{ type: "text" as const, text: toCsv(rows) || "(sin filas)" }] };
    }),
  );

  server.registerTool(
    "segmentos",
    {
      title: "Segmentos guardados",
      description:
        "Guarda un conjunto de filtros con un nombre (ej. \"GOLD Santiago sin contactos 7d\") para reutilizarlo en cualquier herramienta con el parámetro segmento. Acciones: listar, guardar (nombre + filtros), borrar (nombre).",
      inputSchema: {
        accion: z.enum(["listar", "guardar", "borrar"]),
        nombre: z.string().min(2).max(80).optional(),
        descripcion: z.string().max(300).optional(),
        ...filtrosShape,
      },
      annotations: WRITE,
    },
    guarded("segmentos", ctx, async (args: Filtros & { accion: "listar" | "guardar" | "borrar"; nombre?: string; descripcion?: string }) => {
      if (args.accion === "listar") {
        const rows = await prisma.statsSegment.findMany({ orderBy: { name: "asc" } });
        return jsonResult({ segmentos: rows.map((r) => ({ nombre: r.name, filtros: r.filters, creado: r.createdAt })) });
      }
      if (!args.nombre) return errorResult("Indica el nombre del segmento.");
      if (args.accion === "borrar") {
        const del = await prisma.statsSegment.deleteMany({ where: { name: { equals: args.nombre, mode: "insensitive" } } });
        return jsonResult({ borrados: del.count });
      }
      const { segmento: _s, ...filters } = pickFiltros(args as Record<string, unknown>);
      if (!Object.keys(filters).length) return errorResult("Un segmento necesita al menos un filtro.");
      const row = await prisma.statsSegment.upsert({
        where: { name: args.nombre },
        update: { filters: { ...filters, ...(args.descripcion ? { _descripcion: args.descripcion } : {}) } as Prisma.InputJsonValue },
        create: { name: args.nombre, filters: { ...filters, ...(args.descripcion ? { _descripcion: args.descripcion } : {}) } as Prisma.InputJsonValue, createdById: ctx.userId },
      });
      return jsonResult({ guardado: { nombre: row.name, filtros: row.filters } });
    }),
  );

  server.registerTool(
    "anotaciones",
    {
      title: "Anotaciones del timeline",
      description:
        "Marca eventos en la línea de tiempo (campaña, deploy, caída, cambio de UI, otro) para explicar saltos y para comparar antes/después. Acciones: listar (opcionalmente por periodo), agregar (fecha, tipo, título, notas), borrar (id).",
      inputSchema: {
        accion: z.enum(["listar", "agregar", "borrar"]),
        id: z.string().optional(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional().describe("YYYY-MM-DD o YYYY-MM-DDTHH:MM (hora de Chile)."),
        tipo: z.enum(["campana", "deploy", "caida", "ui", "otro"]).optional(),
        titulo: z.string().min(2).max(120).optional(),
        notas: z.string().max(1000).optional(),
        ...periodShape,
      },
      annotations: WRITE,
    },
    guarded("anotaciones", ctx, async (args: PeriodInput & { accion: string; id?: string; fecha?: string; tipo?: "campana" | "deploy" | "caida" | "ui" | "otro"; titulo?: string; notas?: string }) => {
      if (args.accion === "listar") {
        const where = args.periodo || args.desde || args.hasta ? (() => { const p = resolvePeriod(args); return { date: { gte: p.from, lt: p.to } }; })() : {};
        const rows = await prisma.statsAnnotation.findMany({ where, orderBy: { date: "desc" }, take: 200 });
        return jsonResult({ anotaciones: rows.map((r) => ({ id: r.id, fecha: r.date, tipo: r.kind, titulo: r.title, notas: r.notes })) });
      }
      if (args.accion === "borrar") {
        if (!args.id) return errorResult("Indica el id.");
        const del = await prisma.statsAnnotation.deleteMany({ where: { id: args.id } });
        return jsonResult({ borradas: del.count });
      }
      if (!args.fecha || !args.tipo || !args.titulo) return errorResult("Para agregar indica fecha, tipo y título.");
      const [ymd, hm] = args.fecha.split("T");
      const base = new Date(`${ymd}T${hm ?? "12:00"}:00-03:00`);
      const row = await prisma.statsAnnotation.create({ data: { date: base, kind: args.tipo, title: args.titulo, notes: args.notas, createdById: ctx.userId } });
      return jsonResult({ agregada: { id: row.id, fecha: row.date, tipo: row.kind, titulo: row.title } });
    }),
  );

  server.registerTool(
    "alertas",
    {
      title: "Alertas configurables",
      description:
        "Alertas que el servidor evalúa cada hora y avisan a los administradores (notificación y correo) con 24 h de enfriamiento. Tipos: metrica (una métrica contra un umbral o contra su variación % vs periodo anterior, ej. \"contactosWhatsapp variacion_pct menor -30 en 7d\"), perfiles_sin_actualizar (top 20 por vistas sin editar hace más de N días), vistas_sin_contactos (perfiles con ≥ N vistas y 0 contactos). " +
        "Acciones: listar, crear, activar, desactivar, borrar, probar (evalúa ahora sin avisar), evaluar_todas (corre el ciclo completo ahora). Métricas: " + ALERT_METRICS.join(", ") + ".",
      inputSchema: {
        accion: z.enum(["listar", "crear", "activar", "desactivar", "borrar", "probar", "evaluar_todas"]),
        id: z.string().optional(),
        nombre: z.string().min(2).max(120).optional(),
        tipo: z.enum(ALERT_KINDS).optional(),
        metrica: z.string().optional(),
        comparacion: z.enum(["valor", "variacion_pct"]).optional(),
        direccion: z.enum(["menor", "mayor"]).optional(),
        umbral: z.number().optional(),
        periodo: z.enum(ALERT_PERIODS).optional().describe("Periodo evaluado (por defecto 7d)."),
        avisarPorCorreo: z.boolean().optional(),
        ...Object.fromEntries(Object.entries(filtrosShape).filter(([k]) => k !== "segmento")),
      },
      annotations: WRITE,
    },
    guarded("alertas", ctx, async (args: Filtros & { accion: string; id?: string; nombre?: string; tipo?: (typeof ALERT_KINDS)[number]; metrica?: string; comparacion?: "valor" | "variacion_pct"; direccion?: "menor" | "mayor"; umbral?: number; periodo?: string; avisarPorCorreo?: boolean }) => {
      const show = (a: any) => ({ id: a.id, nombre: a.name, tipo: a.kind, metrica: a.metric, comparacion: a.comparison, direccion: a.direction, umbral: a.threshold, periodo: a.period, filtros: a.filters, activa: a.enabled, correo: a.notifyEmail, ultimaEvaluacion: a.lastCheckedAt, ultimoDisparo: a.lastFiredAt, ultimoValor: a.lastValue });
      if (args.accion === "listar") return jsonResult({ alertas: (await prisma.statsAlert.findMany({ orderBy: { createdAt: "desc" } })).map(show) });
      if (args.accion === "evaluar_todas") return jsonResult({ disparadas: await runStatsAlerts() });
      if (args.accion === "crear") {
        if (!args.nombre || !args.tipo) return errorResult("Indica nombre y tipo.");
        if (args.tipo === "metrica") {
          if (!args.metrica || !ALERT_METRICS.includes(args.metrica)) return errorResult(`Métrica inválida. Opciones: ${ALERT_METRICS.join(", ")}.`);
          if (!args.comparacion || !args.direccion || args.umbral === undefined) return errorResult("Para tipo metrica indica comparacion, direccion y umbral.");
        }
        const filters = pickFiltros(args as Record<string, unknown>);
        const row = await prisma.statsAlert.create({
          data: {
            name: args.nombre, kind: args.tipo, metric: args.metrica ?? null, comparison: args.comparacion ?? null, direction: args.direccion ?? null,
            threshold: args.umbral ?? null, period: args.periodo ?? "7d", filters: Object.keys(filters).length ? (filters as Prisma.InputJsonValue) : undefined,
            notifyEmail: args.avisarPorCorreo ?? true, createdById: ctx.userId,
          },
        });
        const test = await evaluateAlert(row);
        return jsonResult({ creada: show(row), evaluacionAhora: test });
      }
      if (!args.id) return errorResult("Indica el id de la alerta.");
      const alert = await prisma.statsAlert.findUnique({ where: { id: args.id } });
      if (!alert) return errorResult("Alerta no encontrada.");
      if (args.accion === "probar") return jsonResult({ alerta: show(alert), resultado: await evaluateAlert(alert) });
      if (args.accion === "borrar") { await prisma.statsAlert.delete({ where: { id: alert.id } }); return jsonResult({ borrada: alert.name }); }
      const updated = await prisma.statsAlert.update({ where: { id: alert.id }, data: { enabled: args.accion === "activar" } });
      return jsonResult({ alerta: show(updated) });
    }),
  );

  server.registerTool(
    "informe_semanal_email",
    {
      title: "Informe semanal por correo",
      description:
        "Informe automático los lunes a las 09:00 (Chile) con los KPIs de la semana vs la anterior, top contactos y alertas. Acciones: ver (configuración y vista previa), activar, desactivar, destinatarios (lista de correos; vacío = administradores), enviar_ahora.",
      inputSchema: {
        accion: z.enum(["ver", "activar", "desactivar", "destinatarios", "enviar_ahora"]),
        correos: z.array(z.string().email()).max(10).optional(),
      },
      annotations: WRITE,
    },
    guarded("informe_semanal_email", ctx, async (args: { accion: string; correos?: string[] }) => {
      if (args.accion === "ver") return jsonResult({ configuracion: await weeklyConfig(), vistaPrevia: await buildWeeklyReport() });
      if (args.accion === "activar") return jsonResult({ configuracion: await setWeeklyConfig({ enabled: true }) });
      if (args.accion === "desactivar") return jsonResult({ configuracion: await setWeeklyConfig({ enabled: false }) });
      if (args.accion === "destinatarios") return jsonResult({ configuracion: await setWeeklyConfig({ recipients: args.correos ?? [] }) });
      const result = await sendWeeklyReport(args.correos);
      return jsonResult(result);
    }),
  );
}
