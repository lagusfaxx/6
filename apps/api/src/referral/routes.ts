import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { calculateReferralPayout } from "./payout";

export const referralRouter = Router();

// ── Generate / get referral code for the logged-in creator ──

referralRouter.post(
  "/referrals/code",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profileType: true, username: true, displayName: true },
    });

    if (!user || !["CREATOR", "PROFESSIONAL"].includes(user.profileType)) {
      return res.status(403).json({
        error: "NOT_CREATOR",
        message: "Solo creadoras pueden generar códigos de referido.",
      });
    }

    // Check if already has a code
    const existing = await prisma.creatorReferralCode.findUnique({
      where: { creatorId: userId },
    });
    if (existing) {
      return res.json({ code: existing.code, isActive: existing.isActive });
    }

    // Generate unique code based on username
    const code = await generateUniqueCode(user.username || user.displayName || "REF");

    const referralCode = await prisma.creatorReferralCode.create({
      data: {
        creatorId: userId,
        code,
      },
    });

    // Create initial active cycle
    const now = new Date();
    const cycleEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    await prisma.referralCycle.create({
      data: {
        referralCodeId: referralCode.id,
        cycleStart: now,
        cycleEnd,
        status: "ACTIVE",
      },
    });

    return res.json({ code: referralCode.code, isActive: true });
  }),
);

// ── Get current referral stats for the creator ──

referralRouter.get(
  "/referrals/stats",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const referralCode = await prisma.creatorReferralCode.findUnique({
      where: { creatorId: userId },
      include: {
        cycles: {
          where: { status: "ACTIVE" },
          take: 1,
          orderBy: { cycleStart: "desc" },
        },
      },
    });

    if (!referralCode) {
      return res.json({ hasCode: false });
    }

    const activeCycle = referralCode.cycles[0] || null;

    // Count VALIDATED redemptions in current cycle (only these count for payout)
    const validatedReferrals = activeCycle
      ? await prisma.referralRedemption.count({
          where: { cycleId: activeCycle.id, status: "VALIDATED" },
        })
      : 0;

    // Count PENDING redemptions (registered but conditions not met yet)
    const pendingReferrals = activeCycle
      ? await prisma.referralRedemption.count({
          where: { cycleId: activeCycle.id, status: "PENDING" },
        })
      : 0;

    const currentCycleReferrals = validatedReferrals;

    // Calculate potential payout (only validated count)
    const payout = calculateReferralPayout(currentCycleReferrals);

    // Historical stats
    const totalReferrals = await prisma.referralRedemption.count({
      where: { referralCodeId: referralCode.id },
    });

    const totalEarned = await prisma.referralCycle.aggregate({
      where: { referralCodeId: referralCode.id, status: "PAID" },
      _sum: { totalAmount: true },
    });

    // Past cycles
    const pastCycles = await prisma.referralCycle.findMany({
      where: {
        referralCodeId: referralCode.id,
        status: { not: "ACTIVE" },
      },
      orderBy: { cycleStart: "desc" },
      take: 10,
      select: {
        id: true,
        cycleStart: true,
        cycleEnd: true,
        status: true,
        totalReferrals: true,
        baseAmount: true,
        bonusAmount: true,
        totalAmount: true,
        paidAt: true,
      },
    });

    return res.json({
      hasCode: true,
      code: referralCode.code,
      isActive: referralCode.isActive,
      currentCycle: activeCycle
        ? {
            id: activeCycle.id,
            cycleStart: activeCycle.cycleStart,
            cycleEnd: activeCycle.cycleEnd,
            referrals: currentCycleReferrals, // only validated
            pendingReferrals,                 // waiting on conditions
            daysRemaining: Math.max(
              0,
              Math.ceil(
                (activeCycle.cycleEnd.getTime() - Date.now()) /
                  (24 * 60 * 60 * 1000),
              ),
            ),
            ...payout,
          }
        : null,
      totalReferrals,
      totalEarned: totalEarned._sum.totalAmount || 0,
      pastCycles,
      // Conditions that referred professionals must meet
      validationConditions: [
        { key: "isVerified", label: "Perfil verificado por UZEED" },
        { key: "hasPhoto", label: "Al menos 1 foto subida" },
        { key: "isActive48h", label: "Cuenta activa por 48 horas" },
      ],
      // Show bonus tiers info
      bonusTiers: [
        { minReferrals: 10, perReferral: 10000, bonus: 0, label: "Base" },
        { minReferrals: 15, perReferral: 10000, bonus: 50000, label: "Bonus Plata" },
        { minReferrals: 20, perReferral: 10000, bonus: 100000, label: "Bonus Oro" },
        { minReferrals: 30, perReferral: 10000, bonus: 200000, label: "Bonus Diamante" },
      ],
    });
  }),
);

// ── Validate a referral code (used by registration form) ──

referralRouter.get(
  "/referrals/validate/:code",
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    if (!code || code.length < 4) {
      return res.status(400).json({ error: "INVALID_CODE" });
    }

    const referralCode = await prisma.creatorReferralCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        creator: {
          select: { displayName: true, username: true, avatarUrl: true },
        },
      },
    });

    if (!referralCode || !referralCode.isActive) {
      return res.json({ valid: false });
    }

    return res.json({
      valid: true,
      creator: {
        displayName: referralCode.creator.displayName,
        username: referralCode.creator.username,
        avatarUrl: referralCode.creator.avatarUrl,
      },
    });
  }),
);

// ── List referrals for the creator (detailed view) ──

referralRouter.get(
  "/referrals/list",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const referralCode = await prisma.creatorReferralCode.findUnique({
      where: { creatorId: userId },
    });

    if (!referralCode) {
      return res.json({ referrals: [] });
    }

    const cycleId = (req.query.cycleId as string) || undefined;

    const redemptions = await prisma.referralRedemption.findMany({
      where: {
        referralCodeId: referralCode.id,
        ...(cycleId ? { cycleId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        amountCLP: true,
        status: true,
        hasPhoto: true,
        isVerified: true,
        isActive48h: true,
        validatedAt: true,
        createdAt: true,
        professional: {
          select: {
            displayName: true,
            username: true,
            avatarUrl: true,
            profileType: true,
            city: true,
          },
        },
      },
    });

    return res.json({ referrals: redemptions });
  }),
);

// ── Helper: generate unique referral code ──

async function generateUniqueCode(base: string): Promise<string> {
  const clean = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
  const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  let code = `${clean}${suffix}`;

  // Ensure uniqueness
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.creatorReferralCode.findUnique({
      where: { code },
    });
    if (!existing) return code;
    code = `${clean}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    attempts++;
  }

  // Fallback: timestamp-based
  return `REF${Date.now().toString(36).toUpperCase()}`;
}
