import { Router } from "express";
import { randomBytes } from "crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { calculateReferralPayout } from "./payout";

const validateLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  limit: 10,                  // max 10 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "TOO_MANY_ATTEMPTS", message: "Demasiados intentos. Espera un momento." },
});

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
  validateLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.params;

    // Strict format: 4-12 alphanumeric chars only
    if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) {
      return res.json({ valid: false });
    }

    const referralCode = await prisma.creatorReferralCode.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        isActive: true,
        creator: {
          select: { displayName: true },
        },
      },
    });

    if (!referralCode || !referralCode.isActive) {
      return res.json({ valid: false });
    }

    // Only return first name initial — minimal info leak
    const name = referralCode.creator.displayName;
    const safeDisplay = name ? name.split(" ")[0] : "Creadora";

    return res.json({
      valid: true,
      creatorName: safeDisplay,
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

    let cycleId = (req.query.cycleId as string) || undefined;

    // Validate cycleId belongs to this creator's referral code (prevent IDOR)
    if (cycleId) {
      const cycle = await prisma.referralCycle.findFirst({
        where: { id: cycleId, referralCodeId: referralCode.id },
        select: { id: true },
      });
      if (!cycle) cycleId = undefined; // Silently ignore invalid cycleId
    }

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

function cryptoSuffix(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid confusion
  const bytes = randomBytes(len);
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

async function generateUniqueCode(base: string): Promise<string> {
  const clean = base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
  let code = `${clean}${cryptoSuffix(4)}`; // 4+4 = 8 chars, ~20 bits of entropy

  // Ensure uniqueness
  let attempts = 0;
  while (attempts < 10) {
    const existing = await prisma.creatorReferralCode.findUnique({
      where: { code },
    });
    if (!existing) return code;
    code = `${clean}${cryptoSuffix(5)}`;
    attempts++;
  }

  // Fallback: full random
  return `R${cryptoSuffix(7)}`;
}
