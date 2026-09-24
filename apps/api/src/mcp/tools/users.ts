import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../db";
import { Prisma } from "@prisma/client";
import { config } from "../../config";
import {
  actorKeySql,
  realActionSql,
  realPageViewSql,
  realUserSql,
  realUserWhere,
  staffIdsSql,
  visitorKeySql,
} from "../../lib/statsFilters";
import { localTs } from "../metrics";
import { guarded, type McpContext } from "../audit";
import {
  PROFILE_TYPES,
  TIERS,
  TZ,
  describePeriod,
  errorResult,
  findUserRef,
  jsonResult,
  periodShape,
  resolvePeriod,
  type PeriodInput,
} from "../helpers";

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const MS_DAY = 24 * 60 * 60 * 1000;

/** Lo que se muestra de un perfil en listados. */
const LIST_SELECT = {
  id: true,
  username: true,
  displayName: true,
  email: true,
  phone: true,
  profileType: true,
  role: true,
  tier: true,
  city: true,
  primaryCategory: true,
  isActive: true,
  isVerified: true,
  isOnline: true,
  lastSeen: true,
  profileViews: true,
  completedServices: true,
  membershipExpiresAt: true,
  shopTrialEndsAt: true,
  createdAt: true,
} as const;

type SearchArgs = {
  texto?: string;
  tipoPerfil?: (typeof PROFILE_TYPES)[number];
  ciudad?: string;
  tier?: (typeof TIERS)[number] | "SIN_TIER";
  activo?: boolean;
  verificado?: boolean;
  sinConexionDias?: number;
  registradoDesde?: string;
  registradoHasta?: string;
  orden?: "recientes" | "antiguos" | "vistas" | "ultima_conexion" | "servicios";
  limite?: number;
  offset?: number;
};

const ORDER: Record<NonNullable<SearchArgs["orden"]>, any> = {
  recientes: { createdAt: "desc" },
  antiguos: { createdAt: "asc" },
  vistas: { profileViews: "desc" },
  ultima_conexion: { lastSeen: { sort: "desc", nulls: "last" } },
  servicios: { completedServices: "desc" },
};

type RankingArgs = PeriodInput & {
  metrica:
    | "visitantes_ficha"
    | "visitas_ficha"
    | "contactos_whatsapp"
    | "mensajes_recibidos"
    | "favoritos"
    | "solicitudes"
    | "tasa_contacto"
    | "vistas_totales"
    | "servicios_completados"
    | "ganancias_tokens";
  tipoPerfil?: (typeof PROFILE_TYPES)[number];
  ciudad?: string;
  limite?: number;
};

/**
 * Condición SQL "esta página vista es la ficha de ese perfil". La ficha vive
 * en /profesional/<id>; se acepta también el username por enlaces antiguos.
 */
function profilePathSql(alias: string, idCol: Prisma.Sql, usernameCol: Prisma.Sql): Prisma.Sql {
  const seg = Prisma.sql`split_part(${Prisma.raw(`"${alias}"`)}."path", '/', 3)`;
  return Prisma.sql`(${Prisma.raw(`"${alias}"`)}."path" LIKE '/profesional/%' AND (${seg} = ${idCol}::text OR ${seg} = ${usernameCol}))`;
}

/** Ficha 360: tendencia 30 días, exposición en listados, historial de tier, cambios de nombre/teléfono y reportes. */
async function profile360(id: string) {
  const since30 = new Date(Date.now() - 30 * MS_DAY);
  const [tendencia, exposicion, tierHistory, phoneChanges, nameChanges, reportes] = await Promise.all([
    prisma.$queryRaw<{ dia: string; vistas: number; contactos: number }[]>`
      WITH days AS (SELECT generate_series(date_trunc('day', (now() AT TIME ZONE ${TZ}) - interval '29 days'), date_trunc('day', now() AT TIME ZONE ${TZ}), '1 day'::interval) AS d),
      v AS (SELECT date_trunc('day', ${localTs('pv."createdAt"')}) AS d, COUNT(*)::int AS n FROM "PageView" pv
            WHERE pv."path" LIKE '/profesional/%' AND split_part(pv."path", '/', 3) = ${id} AND pv."createdAt" >= ${since30} AND ${realPageViewSql("pv")} GROUP BY 1),
      c AS (SELECT date_trunc('day', ${localTs('ua."createdAt"')}) AS d, COUNT(DISTINCT ${actorKeySql("ua")})::int AS n FROM "UserAction" ua
            WHERE ua."targetId" = ${id}::uuid AND ua."action" IN ('whatsapp_click','phone_click') AND ua."createdAt" >= ${since30} AND ${realActionSql("ua")} GROUP BY 1)
      SELECT to_char(days.d, 'YYYY-MM-DD') AS dia, COALESCE(v.n, 0)::int AS vistas, COALESCE(c.n, 0)::int AS contactos
      FROM days LEFT JOIN v ON v.d = days.d LEFT JOIN c ON c.d = days.d ORDER BY days.d`,
    prisma.$queryRaw<{ impresiones: number; posicion: number | null }[]>`
      SELECT COALESCE(SUM(impressions), 0)::int AS impresiones, (SUM("positionSum")::float8 / NULLIF(SUM(impressions), 0)) AS posicion
      FROM "ProfileDailyStats" WHERE "profileId" = ${id}::uuid AND "date" >= (now() AT TIME ZONE ${TZ})::date - 30`,
    prisma.profileTierHistory.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { fromTier: true, toTier: true, createdAt: true } }),
    prisma.phoneChangeRequest.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { status: true, createdAt: true, reviewedAt: true } }),
    prisma.nameChangeRequest.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 10, select: { currentName: true, requestedName: true, status: true, createdAt: true, reviewedAt: true } }),
    prisma.$queryRaw<{ n: number; ultimo: Date | null }[]>`
      SELECT COUNT(*)::int AS n, MAX("createdAt") AS ultimo FROM "Notification" WHERE "type" = 'ADMIN_EVENT' AND "data"->>'type' = 'content_reported' AND "data"->>'targetId' = ${id}`,
  ]);
  const vistas30 = tendencia.reduce((a, r) => a + r.vistas, 0);
  const contactos30 = tendencia.reduce((a, r) => a + r.contactos, 0);
  const first = tendencia.slice(0, 15).reduce((a, r) => a + r.vistas, 0);
  const second = tendencia.slice(15).reduce((a, r) => a + r.vistas, 0);
  return {
    ficha360: {
      tendencia30d: {
        puntos: tendencia,
        vistas: vistas30,
        contactos: contactos30,
        tendenciaVistasPct: first ? Math.round(((second - first) / first) * 1000) / 10 : null,
        grafico: "línea doble (vistas y contactos) por día",
      },
      exposicion30d: {
        impresiones: exposicion[0]?.impresiones ?? 0,
        posicionMedia: exposicion[0]?.posicion != null ? Math.round(Number(exposicion[0].posicion) * 10) / 10 : null,
        ctrListadoPct: exposicion[0]?.impresiones ? Math.round((vistas30 / exposicion[0].impresiones) * 1000) / 10 : null,
      },
      historialTier: tierHistory,
      cambiosTelefono: phoneChanges,
      cambiosNombre: nameChanges,
      reportes: { total: reportes[0]?.n ?? 0, ultimo: reportes[0]?.ultimo ?? null },
    },
  };
}

/** Visitas, visitantes y contactos reales de la ficha de un perfil desde `since`. */
async function profileActivity(id: string, username: string, since: Date) {
  const [views, clicks] = await Promise.all([
    prisma.$queryRaw<{ visitas: number; visitantes: number }[]>`
      SELECT COUNT(*)::int AS visitas, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes
      FROM "PageView" pv
      WHERE pv."createdAt" >= ${since} AND ${realPageViewSql("pv")}
        AND ${profilePathSql("pv", Prisma.sql`${id}::uuid`, Prisma.sql`${username}`)}`,
    prisma.$queryRaw<{ action: string; clicks: number; unicos: number }[]>`
      SELECT ua."action", COUNT(*)::int AS clicks,
             COUNT(DISTINCT (${actorKeySql("ua")} || ':' || to_char(${localTs('ua."createdAt"')}, 'YYYY-MM-DD')))::int AS unicos
      FROM "UserAction" ua
      WHERE ua."targetId" = ${id}::uuid AND ua."createdAt" >= ${since} AND ${realActionSql("ua")}
      GROUP BY 1`,
  ]);
  const byAction = Object.fromEntries(clicks.map((c) => [c.action, { clicks: c.clicks, contactosUnicos: c.unicos }]));
  const visitors = views[0]?.visitantes ?? 0;
  const whatsappUnique = byAction.whatsapp_click?.contactosUnicos ?? 0;
  return {
    visitasFicha: views[0]?.visitas ?? 0,
    visitantesFicha: visitors,
    acciones: byAction,
    // Qué parte de quienes vieron la ficha escribió por WhatsApp.
    tasaContactoWhatsappPct: visitors ? Math.round((whatsappUnique / visitors) * 1000) / 10 : null,
  };
}

export function registerUserTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "buscar_usuarios",
    {
      title: "Buscar usuarios y perfiles",
      description:
        "Busca y filtra usuarios (clientes, profesionales, establecimientos, tiendas...). Filtros por texto (nombre, username, email, teléfono), tipo, ciudad, tier, activo, verificado, días sin conectarse y fecha de registro. Devuelve total y la página pedida.",
      inputSchema: {
        texto: z.string().optional(),
        tipoPerfil: z.enum(PROFILE_TYPES).optional(),
        ciudad: z.string().optional(),
        tier: z.enum([...TIERS, "SIN_TIER"]).optional(),
        activo: z.boolean().optional(),
        verificado: z.boolean().optional(),
        sinConexionDias: z.number().int().min(1).optional().describe("Sólo quienes no se conectan hace al menos N días."),
        registradoDesde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        registradoHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        orden: z.enum(["recientes", "antiguos", "vistas", "ultima_conexion", "servicios"]).optional(),
        limite: z.number().int().min(1).max(200).optional().describe("Por defecto 50."),
        offset: z.number().int().min(0).optional(),
      },
      annotations: READ,
    },
    guarded("buscar_usuarios", ctx, async (args: SearchArgs) => {
      const where: any = {};
      const and: any[] = [];
      if (args.texto) {
        const q = args.texto.trim();
        and.push({
          OR: [
            { username: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        });
      }
      if (args.tipoPerfil) where.profileType = args.tipoPerfil;
      if (args.ciudad) where.city = { contains: args.ciudad, mode: "insensitive" };
      if (args.tier) where.tier = args.tier === "SIN_TIER" ? null : args.tier;
      if (args.activo !== undefined) where.isActive = args.activo;
      if (args.verificado !== undefined) where.isVerified = args.verificado;
      if (args.sinConexionDias) {
        const limit = new Date(Date.now() - args.sinConexionDias * MS_DAY);
        and.push({ OR: [{ lastSeen: { lt: limit } }, { lastSeen: null }] });
      }
      if (args.registradoDesde || args.registradoHasta) {
        const period = resolvePeriod({ desde: args.registradoDesde, hasta: args.registradoHasta });
        where.createdAt = { gte: period.from, lt: period.to };
      }
      if (and.length) where.AND = and;

      const take = args.limite ?? 50;
      const [total, usuarios] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          select: LIST_SELECT,
          orderBy: ORDER[args.orden || "recientes"],
          take,
          skip: args.offset ?? 0,
        }),
      ]);
      return jsonResult({ total, mostrando: usuarios.length, offset: args.offset ?? 0, usuarios });
    }),
  );

  server.registerTool(
    "ver_usuario",
    {
      title: "Ficha completa de un usuario",
      description:
        "Todo sobre un usuario por id, username o email: datos del perfil, membresía, billetera, actividad (mensajes, favoritos, clicks a WhatsApp, visitas a su ficha en 30 días), fotos, historias, pagos recientes, solicitudes pendientes, U-Mate y marketplace.",
      inputSchema: { usuario: z.string().describe("id (uuid), username o email") },
      annotations: READ,
    },
    guarded("ver_usuario", ctx, async ({ usuario }: { usuario: string }) => {
      const id = await findUserRef(usuario);
      if (!id) return errorResult(`No encontré al usuario "${usuario}".`);

      const user = await prisma.user.findUnique({
        where: { id },
        select: {
          ...LIST_SELECT,
          gender: true,
          address: true,
          bio: true,
          birthdate: true,
          serviceCategory: true,
          profileTags: true,
          serviceTags: true,
          baseRate: true,
          minDurationMinutes: true,
          acceptsIncalls: true,
          acceptsOutcalls: true,
          avgResponseMinutes: true,
          verifiedAt: true,
          verifiedByPhone: true,
          profileCompletedAt: true,
          adminManaged: true,
          adminQualityScore: true,
          autoReplyEnabled: true,
          twoFactorEnabled: true,
          avatarUrl: true,
          category: { select: { name: true } },
          wallet: { select: { balance: true, heldBalance: true, totalEarned: true, totalSpent: true } },
          umateCreator: {
            select: { status: true, subscriberCount: true, totalPosts: true, monthlyPriceCLP: true, totalEarned: true, availableBalance: true },
          },
          marketSeller: { select: { storeName: true, isActive: true, isBanned: true, totalSales: true, totalEarnedClp: true } },
        },
      });
      if (!user) return errorResult("Usuario no encontrado.");

      const since30 = new Date(Date.now() - 30 * MS_DAY);
      const [
        messagesSent,
        messagesReceived,
        unreadReceived,
        favoritesReceived,
        profileStats,
        photos,
        videos,
        activeStories,
        requestsAsPro,
        requestsAsClient,
        payments,
        pendingDocs,
        pendingPhone,
        pendingName,
        faceVerification,
      ] = await Promise.all([
        prisma.message.count({ where: { fromId: id } }),
        prisma.message.count({ where: { toId: id } }),
        prisma.message.count({ where: { toId: id, readAt: null } }),
        prisma.favorite.count({ where: { professionalId: id } }),
        profileActivity(id, user.username, since30),
        prisma.profileMedia.count({ where: { ownerId: id, type: "IMAGE" } }),
        prisma.profileMedia.count({ where: { ownerId: id, type: "VIDEO" } }),
        prisma.story.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
        prisma.serviceRequest.groupBy({ by: ["status"], where: { professionalId: id }, _count: { _all: true } }),
        prisma.serviceRequest.count({ where: { clientId: id } }),
        prisma.paymentIntent.findMany({
          where: { OR: [{ subscriberId: id }, { profileId: id }] },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { id: true, purpose: true, method: true, status: true, amount: true, paidAt: true, createdAt: true },
        }),
        prisma.professionalDocument.count({ where: { userId: id, status: "PENDING" } }),
        prisma.phoneChangeRequest.count({ where: { userId: id, status: "PENDING" } }),
        prisma.nameChangeRequest.count({ where: { userId: id, status: "PENDING" } }),
        prisma.faceVerification.findFirst({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          select: { status: true, submittedAt: true, reviewedAt: true },
        }),
      ]);

      const extras360 = await profile360(id);
      const now = new Date();
      const membershipActive = !!user.membershipExpiresAt && user.membershipExpiresAt > now;
      const trialActive = !!user.shopTrialEndsAt && user.shopTrialEndsAt > now;

      return jsonResult({
        usuario: user,
        urlPublica: `${config.appUrl.replace(/\/$/, "")}/profesional/${user.id}`,
        membresia: {
          activa: membershipActive,
          venceEl: user.membershipExpiresAt,
          enPrueba: trialActive,
          pruebaTerminaEl: user.shopTrialEndsAt,
        },
        actividad: {
          mensajesEnviados: messagesSent,
          mensajesRecibidos: messagesReceived,
          mensajesSinLeer: unreadReceived,
          favoritosRecibidos: favoritesReceived,
          ultimos30Dias: profileStats,
          solicitudesComoProfesional: Object.fromEntries(requestsAsPro.map((r) => [r.status, r._count._all])),
          solicitudesComoCliente: requestsAsClient,
        },
        contenido: { fotos: photos, videos, historiasActivas: activeStories },
        pendientes: {
          documentos: pendingDocs,
          cambioTelefono: pendingPhone,
          cambioNombre: pendingName,
          verificacionFacial: faceVerification,
        },
        pagosRecientes: payments,
        ...extras360,
      });
    }),
  );

  server.registerTool(
    "ranking_perfiles",
    {
      title: "Ranking de perfiles",
      description:
        "Top de perfiles por una métrica, con datos limpios (sin bots, sin el equipo, sin perfiles de prueba). Con periodo: visitantes_ficha (personas distintas que vieron la ficha), visitas_ficha, contactos_whatsapp (únicos por persona y día), mensajes_recibidos (sin el equipo; incluye remitentes únicos), favoritos, solicitudes, tasa_contacto (% de visitantes que escribió por WhatsApp; mínimo 20 visitantes). Acumuladas (ignoran el periodo): vistas_totales, servicios_completados, ganancias_tokens.",
      inputSchema: {
        metrica: z.enum([
          "visitantes_ficha",
          "visitas_ficha",
          "contactos_whatsapp",
          "mensajes_recibidos",
          "favoritos",
          "solicitudes",
          "tasa_contacto",
          "vistas_totales",
          "servicios_completados",
          "ganancias_tokens",
        ]),
        tipoPerfil: z.enum(PROFILE_TYPES).optional().describe("Por defecto PROFESSIONAL."),
        ciudad: z.string().optional(),
        limite: z.number().int().min(1).max(100).optional().describe("Por defecto 20."),
        ...periodShape,
      },
      annotations: READ,
    },
    guarded("ranking_perfiles", ctx, async (args: RankingArgs) => {
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const profileType = args.tipoPerfil || "PROFESSIONAL";
      const cumulative = ["vistas_totales", "servicios_completados", "ganancias_tokens"].includes(args.metrica);

      // Filtro de perfiles dentro del SQL: así el top sale del universo
      // correcto y no de un recorte previo.
      const userFilter = Prisma.sql`u."profileType"::text = ${profileType} AND ${realUserSql("u")}${
        args.ciudad ? Prisma.sql` AND u."city" ILIKE ${"%" + args.ciudad + "%"}` : Prisma.empty
      }`;
      const from = period.from;
      const to = period.to;
      const pvJoin = Prisma.sql`"PageView" pv JOIN "User" u
        ON pv."path" LIKE '/profesional/%'
       AND (split_part(pv."path", '/', 3) = u."id"::text OR split_part(pv."path", '/', 3) = u."username")`;
      const pvWhere = Prisma.sql`pv."createdAt" >= ${from} AND pv."createdAt" < ${to} AND ${realPageViewSql("pv")} AND ${userFilter}`;
      const waUnique = Prisma.sql`COUNT(DISTINCT (${actorKeySql("ua")} || ':' || to_char(${localTs('ua."createdAt"')}, 'YYYY-MM-DD')))`;

      type Row = { id: string; valor: number; detalle: Record<string, number> | null };
      let rows: Row[] = [];
      switch (args.metrica) {
        case "visitantes_ficha":
        case "visitas_ficha": {
          const order = args.metrica === "visitantes_ficha" ? Prisma.raw("visitantes") : Prisma.raw("visitas");
          const r = await prisma.$queryRaw<{ id: string; visitas: number; visitantes: number }[]>`
            SELECT u."id", COUNT(*)::int AS visitas, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes
            FROM ${pvJoin} WHERE ${pvWhere}
            GROUP BY u."id" ORDER BY ${order} DESC LIMIT ${take}`;
          rows = r.map((x) => ({
            id: x.id,
            valor: args.metrica === "visitantes_ficha" ? x.visitantes : x.visitas,
            detalle: { visitas: x.visitas, visitantes: x.visitantes },
          }));
          break;
        }
        case "contactos_whatsapp": {
          const r = await prisma.$queryRaw<{ id: string; unicos: number; clicks: number; personas: number }[]>`
            SELECT u."id", ${waUnique}::int AS unicos, COUNT(*)::int AS clicks, COUNT(DISTINCT ${actorKeySql("ua")})::int AS personas
            FROM "UserAction" ua JOIN "User" u ON u."id" = ua."targetId"
            WHERE ua."action" = 'whatsapp_click' AND ua."createdAt" >= ${from} AND ua."createdAt" < ${to}
              AND ${realActionSql("ua")} AND ${userFilter}
            GROUP BY u."id" ORDER BY unicos DESC, clicks DESC LIMIT ${take}`;
          rows = r.map((x) => ({ id: x.id, valor: x.unicos, detalle: { clicks: x.clicks, personasDistintas: x.personas } }));
          break;
        }
        case "tasa_contacto": {
          const r = await prisma.$queryRaw<{ id: string; visitantes: number; contactos: number }[]>`
            WITH v AS (
              SELECT u."id", COUNT(DISTINCT ${visitorKeySql("pv")})::int AS visitantes
              FROM ${pvJoin} WHERE ${pvWhere} GROUP BY u."id"
            ), c AS (
              SELECT ua."targetId" AS id, ${waUnique}::int AS contactos
              FROM "UserAction" ua
              WHERE ua."action" = 'whatsapp_click' AND ua."createdAt" >= ${from} AND ua."createdAt" < ${to} AND ${realActionSql("ua")}
              GROUP BY 1
            )
            SELECT v."id", v.visitantes, COALESCE(c.contactos, 0)::int AS contactos
            FROM v LEFT JOIN c ON c.id = v."id"
            WHERE v.visitantes >= 20
            ORDER BY COALESCE(c.contactos, 0)::float / v.visitantes DESC, v.visitantes DESC LIMIT ${take}`;
          rows = r.map((x) => ({
            id: x.id,
            valor: Math.round((x.contactos / x.visitantes) * 1000) / 10,
            detalle: { visitantes: x.visitantes, contactosWhatsapp: x.contactos },
          }));
          break;
        }
        case "mensajes_recibidos": {
          const r = await prisma.$queryRaw<{ id: string; mensajes: number; remitentes: number }[]>`
            SELECT u."id", COUNT(*)::int AS mensajes, COUNT(DISTINCT m."fromId")::int AS remitentes
            FROM "Message" m JOIN "User" u ON u."id" = m."toId"
            WHERE m."createdAt" >= ${from} AND m."createdAt" < ${to}
              AND m."fromId" NOT IN ${staffIdsSql()} AND ${userFilter}
            GROUP BY u."id" ORDER BY mensajes DESC LIMIT ${take}`;
          rows = r.map((x) => ({ id: x.id, valor: x.mensajes, detalle: { remitentesUnicos: x.remitentes } }));
          break;
        }
        case "favoritos": {
          const r = await prisma.$queryRaw<{ id: string; valor: number }[]>`
            SELECT u."id", COUNT(*)::int AS valor
            FROM "Favorite" f JOIN "User" u ON u."id" = f."professionalId"
            WHERE f."createdAt" >= ${from} AND f."createdAt" < ${to} AND ${userFilter}
            GROUP BY u."id" ORDER BY valor DESC LIMIT ${take}`;
          rows = r.map((x) => ({ id: x.id, valor: x.valor, detalle: null }));
          break;
        }
        case "solicitudes": {
          const r = await prisma.$queryRaw<{ id: string; valor: number; finalizadas: number }[]>`
            SELECT u."id", COUNT(*)::int AS valor, COUNT(*) FILTER (WHERE sr."status" = 'FINALIZADO')::int AS finalizadas
            FROM "ServiceRequest" sr JOIN "User" u ON u."id" = sr."professionalId"
            WHERE sr."createdAt" >= ${from} AND sr."createdAt" < ${to} AND ${userFilter}
            GROUP BY u."id" ORDER BY valor DESC LIMIT ${take}`;
          rows = r.map((x) => ({ id: x.id, valor: x.valor, detalle: { finalizadas: x.finalizadas } }));
          break;
        }
        case "vistas_totales":
        case "servicios_completados": {
          const field = args.metrica === "vistas_totales" ? "profileViews" : "completedServices";
          const where: Prisma.UserWhereInput = { AND: [realUserWhere(), { profileType }] };
          if (args.ciudad) (where.AND as Prisma.UserWhereInput[]).push({ city: { contains: args.ciudad, mode: "insensitive" } });
          const users = await prisma.user.findMany({
            where,
            orderBy: { [field]: "desc" },
            take,
            select: { id: true, profileViews: true, completedServices: true },
          });
          rows = users.map((u) => ({ id: u.id, valor: u[field], detalle: null }));
          break;
        }
        case "ganancias_tokens": {
          const userWhere: Prisma.UserWhereInput = { AND: [realUserWhere(), { profileType }] };
          if (args.ciudad) (userWhere.AND as Prisma.UserWhereInput[]).push({ city: { contains: args.ciudad, mode: "insensitive" } });
          const wallets = await prisma.wallet.findMany({
            where: { user: userWhere },
            orderBy: { totalEarned: "desc" },
            take,
            select: { userId: true, totalEarned: true, balance: true },
          });
          rows = wallets.map((w) => ({ id: w.userId, valor: w.totalEarned, detalle: { saldoTokens: w.balance } }));
          break;
        }
      }

      const users = await prisma.user.findMany({
        where: { id: { in: rows.map((r) => r.id) } },
        select: { id: true, username: true, displayName: true, city: true, tier: true, isActive: true, isVerified: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      const ranking = rows
        .filter((r) => byId.has(r.id))
        .map((r, i) => ({ posicion: i + 1, valor: r.valor, ...(r.detalle ?? {}), ...byId.get(r.id)! }));

      return jsonResult({
        metrica: args.metrica,
        unidad: args.metrica === "tasa_contacto" ? "% de visitantes que contactó por WhatsApp" : undefined,
        tipoPerfil: profileType,
        periodo: cumulative ? "acumulado histórico" : describePeriod(period),
        ranking,
      });
    }),
  );

  server.registerTool(
    "membresias",
    {
      title: "Membresías y periodos de prueba",
      description:
        "Estado comercial de perfiles de negocio (profesionales, establecimientos, tiendas): activas, por_vencer (en los próximos N días), vencidas (en los últimos N días) o pruebas_vencidas (terminó la prueba y nunca pagó). Incluye resumen con ingreso mensual potencial.",
      inputSchema: {
        estado: z.enum(["activas", "por_vencer", "vencidas", "pruebas_vencidas"]),
        dias: z.number().int().min(1).max(365).optional().describe("Ventana para por_vencer / vencidas. Por defecto 7."),
        limite: z.number().int().min(1).max(500).optional().describe("Por defecto 100."),
      },
      annotations: READ,
    },
    guarded(
      "membresias",
      ctx,
      async (args: { estado: "activas" | "por_vencer" | "vencidas" | "pruebas_vencidas"; dias?: number; limite?: number }) => {
        const now = new Date();
        const dias = args.dias ?? 7;
        const window = dias * MS_DAY;
        // Sin perfiles de prueba ni cargados por admin: no pagan membresía.
        const where: any = {
          AND: [realUserWhere(), { adminManaged: false }],
          profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
        };
        let orderBy: any = { membershipExpiresAt: "asc" };
        switch (args.estado) {
          case "activas":
            where.membershipExpiresAt = { gt: now };
            break;
          case "por_vencer":
            where.membershipExpiresAt = { gt: now, lte: new Date(now.getTime() + window) };
            break;
          case "vencidas":
            where.membershipExpiresAt = { lte: now, gte: new Date(now.getTime() - window) };
            orderBy = { membershipExpiresAt: "desc" };
            break;
          case "pruebas_vencidas":
            where.shopTrialEndsAt = { lt: now };
            where.OR = [{ membershipExpiresAt: null }, { membershipExpiresAt: { lt: now } }];
            orderBy = { shopTrialEndsAt: "desc" };
            break;
        }
        const [total, perfiles] = await Promise.all([
          prisma.user.count({ where }),
          prisma.user.findMany({ where, orderBy, take: args.limite ?? 100, select: LIST_SELECT }),
        ]);
        return jsonResult({
          estado: args.estado,
          criterio: "Sin perfiles de prueba, cuentas del equipo ni perfiles cargados por admin (adminManaged).",
          ventanaDias: args.estado === "activas" || args.estado === "pruebas_vencidas" ? null : dias,
          total,
          precioMembresiaClp: config.membershipPriceClp,
          ingresoMensualAsociadoClp: total * config.membershipPriceClp,
          perfiles,
        });
      },
    ),
  );
}
