import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { calculateReferralPayout } from "./payout";

export const adminReferralRouter = Router();

adminReferralRouter.use(requireAdmin);

// ── List all referral cycles (with filters) ──

adminReferralRouter.get(
  "/admin/referrals/cycles",
  asyncHandler(async (req, res) => {
    const status = req.query.status as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const where: any = {};
    if (status) where.status = status;

    const [cycles, total] = await Promise.all([
      prisma.referralCycle.findMany({
        where,
        orderBy: { cycleStart: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          referralCode: {
            include: {
              creator: {
                select: {
                  id: true,
                  displayName: true,
                  username: true,
                  avatarUrl: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.referralCycle.count({ where }),
    ]);

    return res.json({
      cycles: cycles.map((c) => ({
        ...c,
        creator: c.referralCode.creator,
        code: c.referralCode.code,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }),
);

// ── Mark a cycle as PAID ──

adminReferralRouter.post(
  "/admin/referrals/cycles/:id/pay",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const cycle = await prisma.referralCycle.findUnique({ where: { id } });
    if (!cycle) return res.status(404).json({ error: "CYCLE_NOT_FOUND" });
    if (cycle.status !== "PENDING_PAYMENT") {
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: `El ciclo está en estado ${cycle.status}, solo se puede pagar PENDING_PAYMENT.`,
      });
    }

    // Recalculate payout to be safe
    const payout = calculateReferralPayout(cycle.totalReferrals);

    await prisma.referralCycle.update({
      where: { id },
      data: {
        status: "PAID",
        baseAmount: payout.baseAmount,
        bonusAmount: payout.bonusAmount,
        totalAmount: payout.totalAmount,
        paidAt: new Date(),
      },
    });

    return res.json({
      ok: true,
      totalAmount: payout.totalAmount,
      referrals: cycle.totalReferrals,
    });
  }),
);

// ── Overview stats ──

adminReferralRouter.get(
  "/admin/referrals/stats",
  asyncHandler(async (_req, res) => {
    const [
      totalCodes,
      activeCycles,
      pendingPayment,
      totalPaid,
      totalRedemptions,
    ] = await Promise.all([
      prisma.creatorReferralCode.count(),
      prisma.referralCycle.count({ where: { status: "ACTIVE" } }),
      prisma.referralCycle.findMany({
        where: { status: "PENDING_PAYMENT" },
        select: { totalAmount: true },
      }),
      prisma.referralCycle.aggregate({
        where: { status: "PAID" },
        _sum: { totalAmount: true },
      }),
      prisma.referralRedemption.count(),
    ]);

    return res.json({
      totalCodes,
      activeCycles,
      pendingPaymentCount: pendingPayment.length,
      pendingPaymentTotal: pendingPayment.reduce((s, c) => s + c.totalAmount, 0),
      totalPaid: totalPaid._sum.totalAmount || 0,
      totalRedemptions,
    });
  }),
);

// ── Deactivate/reactivate a creator's referral code ──

adminReferralRouter.patch(
  "/admin/referrals/codes/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ error: "INVALID_BODY" });
    }

    const code = await prisma.creatorReferralCode.update({
      where: { id },
      data: { isActive },
    });

    return res.json({ ok: true, code: code.code, isActive: code.isActive });
  }),
);
