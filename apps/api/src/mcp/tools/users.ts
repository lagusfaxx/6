import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../db";
import { config } from "../../config";
import { guarded, type McpScope } from "../audit";
import {
  PROFILE_TYPES,
  TIERS,
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
    | "visitas_ficha"
    | "clicks_whatsapp"
    | "mensajes_recibidos"
    | "favoritos"
    | "solicitudes"
    | "vistas_totales"
    | "servicios_completados"
    | "ganancias_tokens";
  tipoPerfil?: (typeof PROFILE_TYPES)[number];
  ciudad?: string;
  limite?: number;
};

export function registerUserTools(server: McpServer, scope: McpScope) {
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
    guarded("buscar_usuarios", scope, async (args: SearchArgs) => {
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
    guarded("ver_usuario", scope, async ({ usuario }: { usuario: string }) => {
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
        whatsappTotal,
        whatsapp30,
        profileVisits30,
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
        prisma.userAction.count({ where: { action: "whatsapp_click", targetId: id } }),
        prisma.userAction.count({ where: { action: "whatsapp_click", targetId: id, createdAt: { gte: since30 } } }),
        prisma.pageView.count({ where: { path: { startsWith: `/profesional/${user.username}` }, createdAt: { gte: since30 } } }),
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

      const now = new Date();
      const membershipActive = !!user.membershipExpiresAt && user.membershipExpiresAt > now;
      const trialActive = !!user.shopTrialEndsAt && user.shopTrialEndsAt > now;

      return jsonResult({
        usuario: user,
        urlPublica: `${config.appUrl.replace(/\/$/, "")}/profesional/${user.username}`,
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
          clicksWhatsappTotal: whatsappTotal,
          clicksWhatsapp30d: whatsapp30,
          visitasFicha30d: profileVisits30,
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
      });
    }),
  );

  server.registerTool(
    "ranking_perfiles",
    {
      title: "Ranking de perfiles",
      description:
        "Top de perfiles por una métrica. Con periodo: visitas_ficha, clicks_whatsapp, mensajes_recibidos, favoritos, solicitudes. Acumuladas (ignoran el periodo): vistas_totales, servicios_completados, ganancias_tokens.",
      inputSchema: {
        metrica: z.enum([
          "visitas_ficha",
          "clicks_whatsapp",
          "mensajes_recibidos",
          "favoritos",
          "solicitudes",
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
    guarded("ranking_perfiles", scope, async (args: RankingArgs) => {
      const period = resolvePeriod(args);
      const take = args.limite ?? 20;
      const profileType = args.tipoPerfil || "PROFESSIONAL";
      const userWhere: any = { profileType };
      if (args.ciudad) userWhere.city = { contains: args.ciudad, mode: "insensitive" };
      const range = { gte: period.from, lt: period.to };
      // Pedimos de más porque después se filtra por tipo/ciudad.
      const wide = Math.min(take * 5, 500);

      let scores: { userId: string; valor: number }[] = [];
      switch (args.metrica) {
        case "visitas_ficha": {
          const rows = await prisma.$queryRaw<{ username: string; valor: number }[]>`
            SELECT split_part("path", '/', 3) AS username, COUNT(*)::int AS valor
            FROM "PageView"
            WHERE "path" LIKE '/profesional/%' AND "createdAt" >= ${period.from} AND "createdAt" < ${period.to}
            GROUP BY 1 ORDER BY 2 DESC LIMIT ${wide}`;
          const users = await prisma.user.findMany({
            where: { username: { in: rows.map((r) => decodeURIComponent(r.username)) } },
            select: { id: true, username: true },
          });
          const byName = new Map(users.map((u) => [u.username, u.id]));
          scores = rows
            .map((r) => ({ userId: byName.get(decodeURIComponent(r.username)) || "", valor: r.valor }))
            .filter((r) => r.userId);
          break;
        }
        case "clicks_whatsapp": {
          const rows = await prisma.userAction.groupBy({
            by: ["targetId"],
            where: { action: "whatsapp_click", createdAt: range, targetId: { not: null } },
            _count: { _all: true },
            orderBy: { _count: { targetId: "desc" } },
            take: wide,
          });
          scores = rows.map((r) => ({ userId: r.targetId!, valor: r._count._all }));
          break;
        }
        case "mensajes_recibidos": {
          const rows = await prisma.message.groupBy({
            by: ["toId"],
            where: { createdAt: range },
            _count: { _all: true },
            orderBy: { _count: { toId: "desc" } },
            take: wide,
          });
          scores = rows.map((r) => ({ userId: r.toId, valor: r._count._all }));
          break;
        }
        case "favoritos": {
          const rows = await prisma.favorite.groupBy({
            by: ["professionalId"],
            where: { createdAt: range },
            _count: { _all: true },
            orderBy: { _count: { professionalId: "desc" } },
            take: wide,
          });
          scores = rows.map((r) => ({ userId: r.professionalId, valor: r._count._all }));
          break;
        }
        case "solicitudes": {
          const rows = await prisma.serviceRequest.groupBy({
            by: ["professionalId"],
            where: { createdAt: range },
            _count: { _all: true },
            orderBy: { _count: { professionalId: "desc" } },
            take: wide,
          });
          scores = rows.map((r) => ({ userId: r.professionalId, valor: r._count._all }));
          break;
        }
        case "vistas_totales":
        case "servicios_completados": {
          const field = args.metrica === "vistas_totales" ? "profileViews" : "completedServices";
          const users = await prisma.user.findMany({
            where: userWhere,
            orderBy: { [field]: "desc" },
            take,
            select: { id: true, profileViews: true, completedServices: true },
          });
          scores = users.map((u) => ({ userId: u.id, valor: (u as any)[field] }));
          break;
        }
        case "ganancias_tokens": {
          const wallets = await prisma.wallet.findMany({
            where: { user: userWhere },
            orderBy: { totalEarned: "desc" },
            take,
            select: { userId: true, totalEarned: true },
          });
          scores = wallets.map((w) => ({ userId: w.userId, valor: w.totalEarned }));
          break;
        }
      }

      const users = await prisma.user.findMany({
        where: { ...userWhere, id: { in: scores.map((s) => s.userId) } },
        select: { id: true, username: true, displayName: true, city: true, tier: true, isActive: true, isVerified: true },
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      const ranking = scores
        .filter((s) => byId.has(s.userId))
        .slice(0, take)
        .map((s, i) => ({ posicion: i + 1, valor: s.valor, ...byId.get(s.userId)! }));

      const cumulative = ["vistas_totales", "servicios_completados", "ganancias_tokens"].includes(args.metrica);
      return jsonResult({
        metrica: args.metrica,
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
      scope,
      async (args: { estado: "activas" | "por_vencer" | "vencidas" | "pruebas_vencidas"; dias?: number; limite?: number }) => {
        const now = new Date();
        const dias = args.dias ?? 7;
        const window = dias * MS_DAY;
        const where: any = { profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] } };
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
