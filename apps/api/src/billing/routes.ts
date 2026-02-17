import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";

export const billingRouter = Router();

// Get subscription status for current user
billingRouter.get("/billing/subscription/status", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      profileType: true,
      membershipExpiresAt: true,
      shopTrialEndsAt: true,
      createdAt: true
    }
  });

  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  const requiresPayment = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType);
  
  if (!requiresPayment) {
    return res.json({
      requiresPayment: false,
      isActive: true,
      profileType: user.profileType
    });
  }

  const now = new Date();
  const membershipActive = user.membershipExpiresAt ? user.membershipExpiresAt.getTime() > now.getTime() : false;
  const trialActive = user.shopTrialEndsAt ? user.shopTrialEndsAt.getTime() > now.getTime() : false;
  const isActive = membershipActive || trialActive;

  // Calculate days remaining
  let daysRemaining = 0;
  if (membershipActive && user.membershipExpiresAt) {
    daysRemaining = Math.ceil((user.membershipExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  } else if (trialActive && user.shopTrialEndsAt) {
    daysRemaining = Math.ceil((user.shopTrialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  // Get recent payment intents
  const recentPayments = await prisma.paymentIntent.findMany({
    where: {
      subscriberId: userId,
      purpose: { in: ["MEMBERSHIP_PLAN", "SHOP_PLAN"] }
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      amount: true,
      paidAt: true,
      createdAt: true
    }
  });

  return res.json({
    requiresPayment: true,
    isActive,
    membershipActive,
    trialActive,
    daysRemaining,
    membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null,
    shopTrialEndsAt: user.shopTrialEndsAt?.toISOString() || null,
    profileType: user.profileType,
    subscriptionPrice: config.membershipPriceClp,
    recentPayments
  });
}));
