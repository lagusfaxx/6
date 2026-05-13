import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";

export const adminOverviewRouter = Router();

adminOverviewRouter.use(requireAdmin);

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

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
    const now = new Date();
    const today = startOfDay(now);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
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
      prisma.user.count(),
      prisma.user.count({ where: { profileType: "PROFESSIONAL" } }),
      prisma.user.count({ where: { profileType: "ESTABLISHMENT" } }),
      prisma.user.count({ where: { profileType: "SHOP" } }),
      prisma.user.count({ where: { profileType: { in: ["CLIENT", "VIEWER"] } } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({
        where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({
        where: { OR: [{ isOnline: true }, { lastSeen: { gte: today } }] },
      }),
      prisma.user.count({ where: { lastSeen: { gte: sevenDaysAgo } } }),
      prisma.user.count({
        where: {
          profileType: "PROFESSIONAL",
          OR: [{ isOnline: true }, { lastSeen: { gte: today } }],
        },
      }),
      prisma.user.count({
        where: {
          profileType: "PROFESSIONAL",
          OR: [{ lastSeen: { lt: fortyEightHrAgo } }, { lastSeen: null }],
        },
      }),
      prisma.user.count({
        where: {
          isVerified: false,
          profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
        },
      }),
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
      prisma.tokenDeposit.aggregate({
        _sum: { clpAmount: true },
        _count: { _all: true },
        where: { status: "APPROVED", reviewedAt: { gte: thirtyDaysAgo } },
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
      prisma.userAction.count({
        where: { action: "whatsapp_click", createdAt: { gte: sevenDaysAgo } },
      }),
      prisma.pageView.count({
        where: { createdAt: { gte: sevenDaysAgo }, path: { startsWith: "/profesional" } },
      }),
      prisma.user.groupBy({
        by: ["city"],
        where: {
          profileType: "PROFESSIONAL",
          isActive: true,
          city: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 10,
      }),
      prisma.user.findMany({
        where: { profileType: "PROFESSIONAL", isActive: true },
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
    const revenueWeekClp = paidIntentsWeek._sum.amount || 0;
    const revenueTodayClp = paidIntentsToday._sum.amount || 0;

    const userGrowthVsYesterday =
      newUsersYesterday > 0
        ? ((newUsersToday - newUsersYesterday) / newUsersYesterday) * 100
        : null;
    const userGrowthVsPrevWeek =
      newUsersPrevWeek > 0
        ? ((newUsersWeek - newUsersPrevWeek) / newUsersPrevWeek) * 100
        : null;
    const messagesGrowthVsPrevWeek =
      messagesPrevWeek > 0
        ? ((messagesWeek - messagesPrevWeek) / messagesPrevWeek) * 100
        : null;

    return res.json({
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        professionals: totalProfessionals,
        establishments: totalEstablishments,
        shops: totalShops,
        clients: totalClients,
        newToday: newUsersToday,
        newYesterday: newUsersYesterday,
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
    });
  }),
);
