import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { calculateReferralPayout } from "./payout";
import { sendReferralCampaignEmail } from "../lib/notificationEmail";

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

// ── Send referral campaign email to all creators/professionals ──
// Auto-generates referral codes for those who don't have one yet.
// Uses ReminderLog to prevent sending duplicates.

adminReferralRouter.post(
  "/admin/referrals/campaign/send",
  asyncHandler(async (req, res) => {
    // Optional: send to a test email first
    const testEmail = req.body.testEmail as string | undefined;
    const batchSize = Math.min(100, Number(req.body.batchSize) || 50);

    // Find creators/professionals who haven't received the campaign email
    const profileTypes: ("CREATOR" | "PROFESSIONAL")[] = ["CREATOR", "PROFESSIONAL"];

    if (testEmail) {
      // Test mode: send to a single email with a sample code
      await sendReferralCampaignEmail(testEmail, {
        displayName: "Test User",
        referralCode: "TEST123",
      });
      return res.json({ ok: true, mode: "test", sentTo: testEmail });
    }

    // Find eligible users (active creators/professionals with email)
    const users = await prisma.user.findMany({
      where: {
        profileType: { in: profileTypes },
        isActive: true,
        email: { not: "" },
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        creatorReferralCode: { select: { code: true } },
      },
      take: batchSize,
    });

    // Filter out those who already received the campaign
    const userIds = users.map((u) => u.id);
    const alreadySent = await prisma.reminderLog.findMany({
      where: {
        userId: { in: userIds },
        type: "referral_campaign_v1",
      },
      select: { userId: true },
    });
    const sentSet = new Set(alreadySent.map((r) => r.userId));
    const toSend = users.filter((u) => !sentSet.has(u.id));

    let sentCount = 0;
    let errorCount = 0;

    for (const user of toSend) {
      try {
        // Auto-generate referral code if they don't have one
        let code = user.creatorReferralCode?.code;
        if (!code) {
          code = await generateCodeForUser(user.id, user.username);
        }

        // Mark as sent BEFORE sending (prevents duplicates on failure/retry)
        await prisma.reminderLog.upsert({
          where: { userId_type: { userId: user.id, type: "referral_campaign_v1" } },
          update: { createdAt: new Date() },
          create: { userId: user.id, type: "referral_campaign_v1" },
        });

        await sendReferralCampaignEmail(user.email, {
          displayName: user.displayName,
          referralCode: code,
        });

        sentCount++;
      } catch (err) {
        console.error("[admin/referral-campaign] failed for", user.email, err);
        errorCount++;
      }
    }

    return res.json({
      ok: true,
      mode: "campaign",
      totalEligible: toSend.length,
      sent: sentCount,
      errors: errorCount,
      alreadySent: sentSet.size,
      remainingInDB: users.length - toSend.length,
    });
  }),
);

// ── Campaign progress: how many sent vs remaining ──

adminReferralRouter.get(
  "/admin/referrals/campaign/status",
  asyncHandler(async (_req, res) => {
    const [totalEligible, totalSent] = await Promise.all([
      prisma.user.count({
        where: {
          profileType: { in: ["CREATOR", "PROFESSIONAL"] },
          isActive: true,
          email: { not: "" },
        },
      }),
      prisma.reminderLog.count({
        where: { type: "referral_campaign_v1" },
      }),
    ]);

    return res.json({
      totalEligible,
      totalSent,
      remaining: Math.max(0, totalEligible - totalSent),
    });
  }),
);

// ── Helper: generate referral code for a user ──

async function generateCodeForUser(
  userId: string,
  username: string,
): Promise<string> {
  const clean = (username || "REF")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  let code = `${clean}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.creatorReferralCode.findUnique({
      where: { code },
    });
    if (!existing) break;
    code = `${clean}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    attempts++;
  }

  const referralCode = await prisma.creatorReferralCode.create({
    data: { creatorId: userId, code },
  });

  // Create initial cycle
  const now = new Date();
  await prisma.referralCycle.create({
    data: {
      referralCodeId: referralCode.id,
      cycleStart: now,
      cycleEnd: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
    },
  });

  return code;
}
