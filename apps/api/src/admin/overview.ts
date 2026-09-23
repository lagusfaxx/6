import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";
import { chileStartOfToday, chileStartOfYesterday } from "../lib/chileTime";
import { realActionSql, realPageViewSql, realUserWhere } from "../lib/statsFilters";

export const adminOverviewRouter = Router();

adminOverviewRouter.use(requireAdmin);

/**
 * Business-oriented overview for the admin dashboard. Aggregates:
 *  - user funnel (total, by profile type, new today/this week/this month, retention)
 *  - revenue (paid payment intents in CLP, token deposits, gold registrations)
 *  - engagement (messages, videocalls, service requests, favourites)
 *  - operational backlog (pending verifications, deposits, withdrawals, reports)
 *  - growth deltas (today vs yesterday, this week vs previous)
 */
adminOverviewRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    return res.json(await buildAdminOverview());
  }),
);

/** Lo usa también el servidor MCP (`resumen_general`), por eso vive aparte del handler. */
export async function buildAdminOverview() {
  const now = new Date();
  // Días calendario de Chile: el servidor corre en UTC.
  const today = chileStartOfToday(now);
  const yesterday = chileStartOfYesterday(now);
  // "Ayer a esta misma hora": comparar el día en curso contra el día completo
  // de ayer siempre daba caída.
  const yesterdaySameTime = new Date(yesterday.getTime() + (now.getTime() - today.getTime()));
  // Sin perfiles de prueba ni cuentas del equipo.
  const real = realUserWhere();
  const users = (where: Record<string, unknown> = {}) => ({ where: { AND: [real, where] } });
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fortyEightHrAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalProfessionals,
    totalEstablishments,
    totalShops,
    totalClients,
    newUsersToday,
    newUsersYesterday,
    newUsersYesterdaySameTime,
    newUsersWeek,
    newUsersPrevWeek,
    newUsersMonth,
    activeUsersToday,
    activeUsersWeek,
    activeProfessionalsToday,
    inactiveProfessionals48h,
    pendingVerifications,
    pendingDeposits,
    pendingWithdrawals,
    pendingProfessionalDocs,
    paidIntentsMonth,
    paidIntentsWeek,
    paidIntentsToday,
    tokenDepositsApprovedMonth,
    transferDepositsWeek,
    transferDepositsToday,
    messagesWeek,
    messagesPrevWeek,
    videocallsWeek,
    serviceRequestsWeek,
    serviceRequestsCompletedWeek,
    favoritesWeek,
    whatsappClicksWeek,
    profileViewsWeek,
    topCities,
    topProfessionalsByViews,
    topProfessionalsByEarnings,
    revenueByPurpose,
    umateActiveSubs,
  ] = await Promise.all([
    prisma.user.count(users()),
    prisma.user.count(users({ profileType: "PROFESSIONAL" })),
    prisma.user.count(users({ profileType: "ESTABLISHMENT" })),
    prisma.user.count(users({ profileType: "SHOP" })),
    prisma.user.count(users({ profileType: { in: ["CLIENT", "VIEWER"] } })),
    prisma.user.count(users({ createdAt: { gte: today } })),
    prisma.user.count(users({ createdAt: { gte: yesterday, lt: today } })),
    prisma.user.count(users({ createdAt: { gte: yesterday, lt: yesterdaySameTime } })),
    prisma.user.count(users({ createdAt: { gte: sevenDaysAgo } })),
    prisma.user.count(users({ createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } })),
    prisma.user.count(users({ createdAt: { gte: thirtyDaysAgo } })),
    prisma.user.count(users({ OR: [{ isOnline: true }, { lastSeen: { gte: today } }] })),
    prisma.user.count(users({ lastSeen: { gte: sevenDaysAgo } })),
    prisma.user.count(
      users({
        profileType: "PROFESSIONAL",
        OR: [{ isOnline: true }, { lastSeen: { gte: today } }],
      }),
    ),
    prisma.user.count(
      users({
        profileType: "PROFESSIONAL",
        OR: [{ lastSeen: { lt: fortyEightHrAgo } }, { lastSeen: null }],
      }),
    ),
    prisma.user.count(
      users({
        isVerified: false,
        profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
      }),
    ),
    prisma.tokenDeposit.count({ where: { status: "PENDING" } }),
    prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
    prisma.professionalDocument.count({ where: { status: "PENDING" } }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: "PAID", paidAt: { gte: thirtyDaysAgo } },
    }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: "PAID", paidAt: { gte: sevenDaysAgo } },
    }),
    prisma.paymentIntent.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: { status: "PAID", paidAt: { gte: today } },
    }),
    // Sólo transferencias: los depósitos por Flow ya vienen como PaymentIntent
    // TOKEN_PURCHASE pagado y sumarlos otra vez duplicaba ese ingreso.
    prisma.tokenDeposit.aggregate({
      _sum: { clpAmount: true },
      _count: { _all: true },
      where: { status: "APPROVED", method: "TRANSFER", reviewedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.tokenDeposit.aggregate({
      _sum: { clpAmount: true },
      where: { status: "APPROVED", method: "TRANSFER", reviewedAt: { gte: sevenDaysAgo } },
    }),
    prisma.tokenDeposit.aggregate({
      _sum: { clpAmount: true },
      where: { status: "APPROVED", method: "TRANSFER", reviewedAt: { gte: today } },
    }),
    prisma.message.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.message.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    prisma.videocallBooking.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.serviceRequest.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.serviceRequest.count({
      where: { status: "FINALIZADO", updatedAt: { gte: sevenDaysAgo } },
    }),
    prisma.favorite.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    // Sin clicks del equipo ni visitas de bots o del panel.
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "UserAction" ua
      WHERE ua."action" = 'whatsapp_click' AND ua."createdAt" >= ${sevenDaysAgo} AND ${realActionSql("ua")}`.then(
      (r) => r[0]?.n ?? 0,
    ),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "PageView" pv
      WHERE pv."createdAt" >= ${sevenDaysAgo} AND pv."path" LIKE '/profesional/%' AND ${realPageViewSql("pv")}`.then(
      (r) => r[0]?.n ?? 0,
    ),
    prisma.user.groupBy({
      by: ["city"],
      where: {
        AND: [real],
        profileType: "PROFESSIONAL",
        isActive: true,
        city: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.user.findMany({
      where: { AND: [real], profileType: "PROFESSIONAL", isActive: true },
      orderBy: { profileViews: "desc" },
      take: 10,
      select: {
        id: true,
        username: true,
        displayName: true,
        city: true,
        tier: true,
        profileViews: true,
        completedServices: true,
      },
    }),
    prisma.wallet.findMany({
      where: { user: real },
      orderBy: { totalEarned: "desc" },
      take: 10,
      select: {
        totalEarned: true,
        totalSpent: true,
        balance: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            profileType: true,
          },
        },
      },
    }),
    prisma.paymentIntent.groupBy({
      by: ["purpose"],
      where: { status: "PAID", paidAt: { gte: thirtyDaysAgo } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.umateSubscription
      .count({ where: { status: "ACTIVE" } })
      .catch(() => 0),
  ]);

  const revenueMonthClp =
    (paidIntentsMonth._sum.amount || 0) +
    (tokenDepositsApprovedMonth._sum.clpAmount || 0);
  const revenueWeekClp = (paidIntentsWeek._sum.amount || 0) + (transferDepositsWeek._sum.clpAmount || 0);
  const revenueTodayClp = (paidIntentsToday._sum.amount || 0) + (transferDepositsToday._sum.clpAmount || 0);

  const userGrowthVsYesterday =
    newUsersYesterdaySameTime > 0
      ? ((newUsersToday - newUsersYesterdaySameTime) / newUsersYesterdaySameTime) * 100
      : null;
  const userGrowthVsPrevWeek =
    newUsersPrevWeek > 0
      ? ((newUsersWeek - newUsersPrevWeek) / newUsersPrevWeek) * 100
      : null;
  const messagesGrowthVsPrevWeek =
    messagesPrevWeek > 0
      ? ((messagesWeek - messagesPrevWeek) / messagesPrevWeek) * 100
      : null;

  return {
    generatedAt: now.toISOString(),
    users: {
      total: totalUsers,
      professionals: totalProfessionals,
      establishments: totalEstablishments,
      shops: totalShops,
      clients: totalClients,
      newToday: newUsersToday,
      newYesterday: newUsersYesterday,
      newYesterdaySameTime: newUsersYesterdaySameTime,
      newThisWeek: newUsersWeek,
      newPrevWeek: newUsersPrevWeek,
      newThisMonth: newUsersMonth,
      activeToday: activeUsersToday,
      activeThisWeek: activeUsersWeek,
      activeProfessionalsToday,
      inactiveProfessionals48h,
      growthVsYesterdayPct: userGrowthVsYesterday,
      growthVsPrevWeekPct: userGrowthVsPrevWeek,
    },
    backlog: {
      pendingVerifications,
      pendingDeposits,
      pendingWithdrawals,
      pendingProfessionalDocs,
    },
    revenue: {
      todayClp: revenueTodayClp,
      weekClp: revenueWeekClp,
      monthClp: revenueMonthClp,
      paidIntentsMonth: paidIntentsMonth._count._all,
      tokenDepositsApprovedMonth: tokenDepositsApprovedMonth._count._all,
      byPurposeMonth: revenueByPurpose.map((row) => ({
        purpose: row.purpose,
        amountClp: row._sum.amount || 0,
        count: row._count.id,
      })),
    },
    engagement: {
      messagesWeek,
      messagesPrevWeek,
      messagesGrowthPct: messagesGrowthVsPrevWeek,
      videocallsWeek,
      serviceRequestsWeek,
      serviceRequestsCompletedWeek,
      favoritesWeek,
      whatsappClicksWeek,
      profileViewsWeek,
      umateActiveSubs,
    },
    topCities: topCities.map((row) => ({
      city: row.city,
      count: row._count.id,
    })),
    topProfessionalsByViews,
    topProfessionalsByEarnings: topProfessionalsByEarnings.map((w) => ({
      id: w.user?.id,
      username: w.user?.username,
      displayName: w.user?.displayName,
      profileType: w.user?.profileType,
      totalEarnedTokens: w.totalEarned,
      totalSpentTokens: w.totalSpent,
      balanceTokens: w.balance,
    })),
  };
}

/**
 * Profiles whose free trial expired without an active membership, with the
 * potential revenue each one represents (monthly membership price) and an
 * estimate of the revenue lost since the trial ended.
 * Query params: q (search by name/username/email), limit (default 200, max 500).
 */
adminOverviewRouter.get(
  "/expired-trials",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const monthlyPriceClp = config.membershipPriceClp;
    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);

    const baseWhere = {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as any },
      shopTrialEndsAt: { lt: now },
      OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lt: now } }],
      ...(q
        ? {
            AND: [
              {
                OR: [
                  { username: { contains: q, mode: "insensitive" as const } },
                  { displayName: { contains: q, mode: "insensitive" as const } },
                  { email: { contains: q, mode: "insensitive" as const } },
                ],
              },
            ],
          }
        : {}),
    };

    const [total, profiles] = await Promise.all([
      prisma.user.count({ where: baseWhere }),
      prisma.user.findMany({
        where: baseWhere,
        orderBy: { shopTrialEndsAt: "desc" },
        take: limit,
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          phone: true,
          city: true,
          profileType: true,
          avatarUrl: true,
          isActive: true,
          shopTrialEndsAt: true,
          membershipExpiresAt: true,
          lastSeen: true,
          profileViews: true,
          createdAt: true,
        },
      }),
    ]);

    const ids = profiles.map((p) => p.id);
    const [messagesByProfile, favoritesByProfile, whatsappByProfile] = ids.length
      ? await Promise.all([
          prisma.message.groupBy({
            by: ["toId"],
            where: { toId: { in: ids } },
            _count: { id: true },
          }),
          prisma.favorite.groupBy({
            by: ["professionalId"],
            where: { professionalId: { in: ids } },
            _count: { id: true },
          }),
          prisma.userAction.groupBy({
            by: ["targetId"],
            where: { action: "whatsapp_click", targetId: { in: ids } },
            _count: { id: true },
          }),
        ])
      : [[], [], []];

    const messagesMap = new Map(messagesByProfile.map((r) => [r.toId, r._count.id]));
    const favoritesMap = new Map(favoritesByProfile.map((r) => [r.professionalId, r._count.id]));
    const whatsappMap = new Map(whatsappByProfile.map((r) => [r.targetId, r._count.id]));

    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const items = profiles.map((p) => {
      const expiredAt = p.shopTrialEndsAt!;
      const daysExpired = Math.max(Math.floor((now.getTime() - expiredAt.getTime()) / MS_PER_DAY), 0);
      // Months elapsed since the trial ended (capped at 12 to keep the estimate sane)
      const monthsExpired = Math.min(Math.floor(daysExpired / 30), 12);
      return {
        id: p.id,
        username: p.username,
        displayName: p.displayName,
        email: p.email,
        phone: p.phone,
        city: p.city,
        profileType: p.profileType,
        avatarUrl: p.avatarUrl,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        trialEndedAt: expiredAt.toISOString(),
        daysExpired,
        lastSeen: p.lastSeen ? p.lastSeen.toISOString() : null,
        profileViews: p.profileViews,
        messagesReceived: messagesMap.get(p.id) || 0,
        favoritesReceived: favoritesMap.get(p.id) || 0,
        whatsappClicks: whatsappMap.get(p.id) || 0,
        potentialMonthlyClp: monthlyPriceClp,
        estimatedLostClp: monthsExpired * monthlyPriceClp,
      };
    });

    const listedLostClp = items.reduce((acc, i) => acc + i.estimatedLostClp, 0);

    res.json({
      generatedAt: now.toISOString(),
      monthlyPriceClp,
      summary: {
        total,
        listed: items.length,
        potentialMonthlyClp: total * monthlyPriceClp,
        estimatedLostClpListed: listedLostClp,
      },
      items,
    });
  }),
);
