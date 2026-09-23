import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../db";
import { guarded, type McpScope } from "../audit";
import { deltaPct, describePeriod, jsonResult, periodShape, resolvePeriod, type PeriodInput } from "../helpers";

const READ = { readOnlyHint: true, openWorldHint: false } as const;

const PURPOSES = [
  "CREATOR_SUBSCRIPTION",
  "SHOP_PLAN",
  "MEMBERSHIP_PLAN",
  "TOKEN_PURCHASE",
  "UMATE_PLAN",
  "PUBLICATE_GOLD",
  "MARKETPLACE_ORDER",
] as const;

const USER_MINI = { select: { id: true, username: true, displayName: true, profileType: true } } as const;

type Range = { from: Date; to: Date };

async function revenue({ from, to }: Range) {
  const paid = { gte: from, lt: to };
  const [byPurpose, byMethod, deposits, withdrawals, market, marketRefunds, umateLedger, failed] = await Promise.all([
    prisma.paymentIntent.groupBy({
      by: ["purpose"],
      where: { status: "PAID", paidAt: paid },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.paymentIntent.groupBy({
      by: ["method"],
      where: { status: "PAID", paidAt: paid },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.tokenDeposit.groupBy({
      by: ["method"],
      where: { status: "APPROVED", reviewedAt: paid },
      _sum: { clpAmount: true, amount: true },
      _count: { _all: true },
    }),
    prisma.withdrawalRequest.aggregate({
      where: { status: "APPROVED", reviewedAt: paid },
      _sum: { clpAmount: true },
      _count: { _all: true },
    }),
    prisma.marketOrder.aggregate({
      where: { paidAt: paid },
      _sum: { totalClp: true, commissionClp: true, sellerNetClp: true, shippingClp: true },
      _count: { _all: true },
    }),
    prisma.marketOrder.aggregate({
      where: { status: "REFUNDED", updatedAt: paid },
      _sum: { totalClp: true },
      _count: { _all: true },
    }),
    prisma.umateLedgerEntry.groupBy({
      by: ["type"],
      where: { createdAt: paid },
      _sum: { grossAmount: true, platformFee: true, creatorPayout: true, ivaAmount: true, flowFee: true, netAmount: true },
      _count: { _all: true },
    }),
    prisma.paymentIntent.groupBy({
      by: ["status"],
      where: { status: { in: ["FAILED", "EXPIRED"] }, createdAt: paid },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const totalPaid = byPurpose.reduce((acc, r) => acc + (r._sum.amount || 0), 0);
  // Los depósitos por Flow ya están contados como PaymentIntent TOKEN_PURCHASE;
  // sólo las transferencias manuales son ingreso adicional.
  const transferDeposits = deposits.find((d) => d.method === "TRANSFER");
  const transferClp = transferDeposits?._sum.clpAmount || 0;

  return {
    totalCobradoClp: totalPaid + transferClp,
    pagosPasarelaYTransferenciaClp: totalPaid,
    depositosTokensPorTransferenciaClp: transferClp,
    porProposito: byPurpose
      .map((r) => ({ proposito: r.purpose, clp: r._sum.amount || 0, pagos: r._count._all }))
      .sort((a, b) => b.clp - a.clp),
    porMetodo: byMethod.map((r) => ({ metodo: r.method, clp: r._sum.amount || 0, pagos: r._count._all })),
    depositosTokens: deposits.map((d) => ({
      metodo: d.method,
      clp: d._sum.clpAmount || 0,
      tokens: d._sum.amount || 0,
      depositos: d._count._all,
    })),
    retirosAprobados: { clp: withdrawals._sum.clpAmount || 0, retiros: withdrawals._count._all },
    marketplace: {
      pedidosPagados: market._count._all,
      ventasClp: market._sum.totalClp || 0,
      comisionClp: market._sum.commissionClp || 0,
      netoVendedorasClp: market._sum.sellerNetClp || 0,
      enviosClp: market._sum.shippingClp || 0,
      reembolsados: marketRefunds._count._all,
      reembolsadoClp: marketRefunds._sum.totalClp || 0,
    },
    umateLibroContable: umateLedger.map((r) => ({
      tipo: r.type,
      movimientos: r._count._all,
      brutoClp: r._sum.grossAmount || 0,
      comisionPlataformaClp: r._sum.platformFee || 0,
      pagoCreadorasClp: r._sum.creatorPayout || 0,
      ivaClp: r._sum.ivaAmount || 0,
      comisionFlowClp: r._sum.flowFee || 0,
      netoClp: r._sum.netAmount || 0,
    })),
    pagosFallidosOExpirados: failed.map((r) => ({ estado: r.status, clp: r._sum.amount || 0, intentos: r._count._all })),
  };
}

export function registerBusinessTools(server: McpServer, scope: McpScope) {
  server.registerTool(
    "informe_ingresos",
    {
      title: "Informe de ingresos",
      description:
        "Informe financiero de un periodo: total cobrado, por propósito (membresías, planes, tokens, U-Mate, Gold, marketplace), por método (Flow/transferencia), depósitos y retiros de tokens, marketplace (ventas, comisión, reembolsos), libro contable U-Mate, pagos fallidos, top pagadores y comparación con el periodo anterior. Montos en CLP.",
      inputSchema: {
        ...periodShape,
        topPagadores: z.number().int().min(0).max(50).optional().describe("Cuántos mayores pagadores listar (por defecto 10)."),
      },
      annotations: READ,
    },
    guarded("informe_ingresos", scope, async (args: PeriodInput & { topPagadores?: number }) => {
      const period = resolvePeriod(args);
      const [current, previous, topPayers] = await Promise.all([
        revenue(period),
        revenue(period.previous),
        prisma.paymentIntent.groupBy({
          by: ["subscriberId"],
          where: { status: "PAID", paidAt: { gte: period.from, lt: period.to } },
          _sum: { amount: true },
          _count: { _all: true },
          orderBy: { _sum: { amount: "desc" } },
          take: args.topPagadores ?? 10,
        }),
      ]);
      const payers = await prisma.user.findMany({
        where: { id: { in: topPayers.map((p) => p.subscriberId) } },
        select: { id: true, username: true, displayName: true, profileType: true },
      });
      const byId = new Map(payers.map((p) => [p.id, p]));
      return jsonResult({
        periodo: describePeriod(period),
        ...current,
        comparacion: {
          totalCobradoAnteriorClp: previous.totalCobradoClp,
          variacionPct: deltaPct(current.totalCobradoClp, previous.totalCobradoClp),
          ticketPromedioClp: current.porProposito.length
            ? Math.round(
                current.pagosPasarelaYTransferenciaClp /
                  Math.max(1, current.porProposito.reduce((a, r) => a + r.pagos, 0)),
              )
            : 0,
        },
        topPagadores: topPayers.map((p) => ({
          ...byId.get(p.subscriberId),
          totalClp: p._sum.amount || 0,
          pagos: p._count._all,
        })),
      });
    }),
  );

  server.registerTool(
    "listar_pagos",
    {
      title: "Listar pagos",
      description: "Lista pagos (PaymentIntent) filtrando por estado, propósito, método y periodo (por fecha de creación). Incluye quién pagó y a qué perfil.",
      inputSchema: {
        estado: z.enum(["PENDING", "PAID", "FAILED", "EXPIRED"]).optional(),
        proposito: z.enum(PURPOSES).optional(),
        metodo: z.enum(["FLOW", "TRANSFER"]).optional(),
        limite: z.number().int().min(1).max(200).optional().describe("Por defecto 50."),
        ...periodShape,
      },
      annotations: READ,
    },
    guarded(
      "listar_pagos",
      scope,
      async (args: PeriodInput & { estado?: any; proposito?: any; metodo?: any; limite?: number }) => {
        const period = resolvePeriod(args);
        const where: any = { createdAt: { gte: period.from, lt: period.to } };
        if (args.estado) where.status = args.estado;
        if (args.proposito) where.purpose = args.proposito;
        if (args.metodo) where.method = args.metodo;
        const [total, sum, pagos] = await Promise.all([
          prisma.paymentIntent.count({ where }),
          prisma.paymentIntent.aggregate({ where, _sum: { amount: true } }),
          prisma.paymentIntent.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: args.limite ?? 50,
            select: {
              id: true,
              purpose: true,
              method: true,
              status: true,
              amount: true,
              notes: true,
              paidAt: true,
              createdAt: true,
              subscriber: USER_MINI,
              profile: USER_MINI,
            },
          }),
        ]);
        return jsonResult({ periodo: describePeriod(period), total, montoTotalClp: sum._sum.amount || 0, pagos });
      },
    ),
  );

  server.registerTool(
    "pendientes",
    {
      title: "Pendientes operativos",
      description:
        "Todas las colas que esperan acción del equipo, con conteo y los más antiguos de cada una: verificaciones de perfil, verificación facial, documentos, cambios de teléfono y nombre, depósitos y retiros de tokens, pagos por transferencia, pedidos y disputas del marketplace, retiros de vendedoras, creadoras U-Mate por revisar y retiros U-Mate.",
      inputSchema: {
        porCola: z.number().int().min(0).max(50).optional().describe("Cuántos ítems mostrar por cola (por defecto 5)."),
      },
      annotations: READ,
    },
    guarded("pendientes", scope, async (args: { porCola?: number }) => {
      const take = args.porCola ?? 5;
      const asc = { createdAt: "asc" } as const;
      const unverified = { isVerified: false, profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as any } };
      const q = <T>(count: Promise<number>, items: Promise<T>) => Promise.all([count, items]);

      const [
        verifications,
        faces,
        docs,
        phones,
        names,
        deposits,
        withdrawals,
        transfers,
        marketReview,
        disputes,
        marketWithdrawals,
        umateCreators,
        umateWithdrawals,
      ] = await Promise.all([
        q(
          prisma.user.count({ where: unverified }),
          prisma.user.findMany({
            where: unverified,
            orderBy: asc,
            take,
            select: { id: true, username: true, displayName: true, profileType: true, city: true, createdAt: true },
          }),
        ),
        q(
          prisma.faceVerification.count({ where: { status: "SUBMITTED" } }),
          prisma.faceVerification.findMany({
            where: { status: "SUBMITTED" },
            orderBy: { submittedAt: "asc" },
            take,
            select: { id: true, submittedAt: true, user: USER_MINI },
          }),
        ),
        q(
          prisma.professionalDocument.count({ where: { status: "PENDING" } }),
          prisma.professionalDocument.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, originalName: true, createdAt: true, user: USER_MINI },
          }),
        ),
        q(
          prisma.phoneChangeRequest.count({ where: { status: "PENDING" } }),
          prisma.phoneChangeRequest.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, requestedPhone: true, reason: true, createdAt: true, user: USER_MINI },
          }),
        ),
        q(
          prisma.nameChangeRequest.count({ where: { status: "PENDING" } }),
          prisma.nameChangeRequest.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, currentName: true, requestedName: true, reason: true, createdAt: true, user: USER_MINI },
          }),
        ),
        q(
          prisma.tokenDeposit.count({ where: { status: "PENDING" } }),
          prisma.tokenDeposit.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, amount: true, clpAmount: true, method: true, createdAt: true, wallet: { select: { user: USER_MINI } } },
          }),
        ),
        q(
          prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
          prisma.withdrawalRequest.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, amount: true, clpAmount: true, createdAt: true, wallet: { select: { user: USER_MINI } } },
          }),
        ),
        q(
          prisma.paymentIntent.count({ where: { status: "PENDING", method: "TRANSFER" } }),
          prisma.paymentIntent.findMany({
            where: { status: "PENDING", method: "TRANSFER" },
            orderBy: asc,
            take,
            select: { id: true, purpose: true, amount: true, createdAt: true, subscriber: USER_MINI },
          }),
        ),
        q(
          prisma.marketOrder.count({ where: { status: "PAYMENT_REVIEW" } }),
          prisma.marketOrder.findMany({
            where: { status: "PAYMENT_REVIEW" },
            orderBy: asc,
            take,
            select: { id: true, code: true, productTitle: true, totalClp: true, createdAt: true },
          }),
        ),
        q(
          prisma.marketOrder.count({ where: { status: "DISPUTED" } }),
          prisma.marketOrder.findMany({
            where: { status: "DISPUTED" },
            orderBy: { disputedAt: "asc" },
            take,
            select: { id: true, code: true, productTitle: true, totalClp: true, disputedAt: true, disputeReason: true },
          }),
        ),
        q(
          prisma.marketWithdrawal.count({ where: { status: "PENDING" } }),
          prisma.marketWithdrawal.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, amountClp: true, createdAt: true, userId: true },
          }),
        ),
        q(
          prisma.umateCreator.count({ where: { status: "PENDING_REVIEW" } }),
          prisma.umateCreator.findMany({
            where: { status: "PENDING_REVIEW" },
            orderBy: asc,
            take,
            select: { id: true, displayName: true, createdAt: true, user: USER_MINI },
          }),
        ),
        q(
          prisma.umateWithdrawal.count({ where: { status: "PENDING" } }),
          prisma.umateWithdrawal.findMany({
            where: { status: "PENDING" },
            orderBy: asc,
            take,
            select: { id: true, amount: true, creatorId: true, createdAt: true },
          }),
        ),
      ]);

      const queue = <T>([total, items]: [number, T]) => ({ total, masAntiguos: items });
      const colas = {
        verificacionesPerfil: queue(verifications),
        verificacionFacial: queue(faces),
        documentosProfesionales: queue(docs),
        cambiosTelefono: queue(phones),
        cambiosNombre: queue(names),
        depositosTokens: queue(deposits),
        retirosTokens: queue(withdrawals),
        pagosPorTransferencia: queue(transfers),
        marketplaceComprobantes: queue(marketReview),
        marketplaceDisputas: queue(disputes),
        marketplaceRetiros: queue(marketWithdrawals),
        umateCreadorasPorRevisar: queue(umateCreators),
        umateRetiros: queue(umateWithdrawals),
      };
      const totalPendiente = Object.values(colas).reduce((acc, c) => acc + c.total, 0);
      return jsonResult({ totalPendiente, colas });
    }),
  );

  server.registerTool(
    "resumen_marketplace",
    {
      title: "Resumen del marketplace",
      description:
        "Estado del marketplace en un periodo: pedidos por estado, ventas, comisión, top vendedoras, top productos, catálogo (activos/ocultos por tipo) y vendedoras activas/baneadas.",
      inputSchema: { ...periodShape, limite: z.number().int().min(1).max(50).optional() },
      annotations: READ,
    },
    guarded("resumen_marketplace", scope, async (args: PeriodInput & { limite?: number }) => {
      const period = resolvePeriod(args);
      const take = args.limite ?? 10;
      const created = { gte: period.from, lt: period.to };
      const [byStatus, paid, topSellers, topProducts, catalog, sellers] = await Promise.all([
        prisma.marketOrder.groupBy({ by: ["status"], where: { createdAt: created }, _count: { _all: true }, _sum: { totalClp: true } }),
        prisma.marketOrder.aggregate({
          where: { paidAt: created },
          _sum: { totalClp: true, commissionClp: true },
          _count: { _all: true },
        }),
        prisma.marketOrder.groupBy({
          by: ["sellerId"],
          where: { paidAt: created },
          _sum: { totalClp: true, commissionClp: true },
          _count: { _all: true },
          orderBy: { _sum: { totalClp: "desc" } },
          take,
        }),
        prisma.marketOrder.groupBy({
          by: ["productTitle"],
          where: { paidAt: created },
          _sum: { totalClp: true },
          _count: { _all: true },
          orderBy: { _count: { productTitle: "desc" } },
          take,
        }),
        prisma.marketProduct.groupBy({ by: ["type", "isActive", "isHidden"], _count: { _all: true } }),
        prisma.marketSeller.groupBy({ by: ["isActive", "isBanned"], _count: { _all: true } }),
      ]);
      const sellerUsers = await prisma.user.findMany({
        where: { id: { in: topSellers.map((s) => s.sellerId) } },
        select: { id: true, username: true, displayName: true },
      });
      const byId = new Map(sellerUsers.map((u) => [u.id, u]));
      return jsonResult({
        periodo: describePeriod(period),
        pedidosCreadosPorEstado: byStatus.map((r) => ({ estado: r.status, pedidos: r._count._all, clp: r._sum.totalClp || 0 })),
        pagados: { pedidos: paid._count._all, ventasClp: paid._sum.totalClp || 0, comisionClp: paid._sum.commissionClp || 0 },
        topVendedoras: topSellers.map((s) => ({
          ...byId.get(s.sellerId),
          pedidos: s._count._all,
          ventasClp: s._sum.totalClp || 0,
          comisionClp: s._sum.commissionClp || 0,
        })),
        topProductos: topProducts.map((p) => ({ producto: p.productTitle, pedidos: p._count._all, ventasClp: p._sum.totalClp || 0 })),
        catalogo: catalog.map((c) => ({ tipo: c.type, activo: c.isActive, oculto: c.isHidden, productos: c._count._all })),
        vendedoras: sellers.map((s) => ({ activa: s.isActive, baneada: s.isBanned, total: s._count._all })),
      });
    }),
  );

  server.registerTool(
    "resumen_umate",
    {
      title: "Resumen de U-Mate",
      description:
        "Estado de U-Mate (suscripciones a creadoras): creadoras por estado, suscripciones directas por estado, nuevas y canceladas en el periodo, top creadoras por suscriptoras y ganancias, y libro contable del periodo.",
      inputSchema: { ...periodShape, limite: z.number().int().min(1).max(50).optional() },
      annotations: READ,
    },
    guarded("resumen_umate", scope, async (args: PeriodInput & { limite?: number }) => {
      const period = resolvePeriod(args);
      const take = args.limite ?? 10;
      const created = { gte: period.from, lt: period.to };
      const [creators, subsByStatus, newSubs, cancelled, topCreators, ledger, planSubs] = await Promise.all([
        prisma.umateCreator.groupBy({ by: ["status"], _count: { _all: true } }),
        prisma.umateDirectSubscription.groupBy({ by: ["status"], _count: { _all: true }, _sum: { priceCLP: true } }),
        prisma.umateDirectSubscription.count({ where: { createdAt: created } }),
        prisma.umateDirectSubscription.count({ where: { cancelledAt: created } }),
        prisma.umateCreator.findMany({
          where: { status: "ACTIVE" },
          orderBy: { subscriberCount: "desc" },
          take,
          select: {
            displayName: true,
            subscriberCount: true,
            totalPosts: true,
            monthlyPriceCLP: true,
            totalEarned: true,
            availableBalance: true,
            pendingBalance: true,
            user: { select: { username: true } },
          },
        }),
        prisma.umateLedgerEntry.groupBy({
          by: ["type"],
          where: { createdAt: created },
          _sum: { grossAmount: true, platformFee: true, creatorPayout: true },
          _count: { _all: true },
        }),
        prisma.umateSubscription.groupBy({ by: ["status"], _count: { _all: true } }),
      ]);
      return jsonResult({
        periodo: describePeriod(period),
        creadorasPorEstado: creators.map((c) => ({ estado: c.status, total: c._count._all })),
        suscripcionesDirectasPorEstado: subsByStatus.map((s) => ({
          estado: s.status,
          total: s._count._all,
          sumaPrecioMensualClp: s._sum.priceCLP || 0,
        })),
        suscripcionesPlanPorEstado: planSubs.map((s) => ({ estado: s.status, total: s._count._all })),
        nuevasEnPeriodo: newSubs,
        canceladasEnPeriodo: cancelled,
        topCreadoras: topCreators,
        libroContable: ledger.map((l) => ({
          tipo: l.type,
          movimientos: l._count._all,
          brutoClp: l._sum.grossAmount || 0,
          comisionPlataformaClp: l._sum.platformFee || 0,
          pagoCreadorasClp: l._sum.creatorPayout || 0,
        })),
      });
    }),
  );
}
