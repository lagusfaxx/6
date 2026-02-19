import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createFlowCustomer,
  createFlowSubscription,
  getFlowSubscription
} from "../khipu/client";

export const billingRouter = Router();

// ── Flow subscription start (one-click: creates customer + subscription) ────

billingRouter.post("/billing/subscription/start", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      profileType: true,
      flowCustomerId: true,
      flowSubscriptionId: true
    }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED", message: "Este tipo de perfil no requiere suscripción" });
  }

  // 1) Ensure Flow customer exists
  let customerId = user.flowCustomerId;
  if (!customerId) {
    const name = (user.displayName || user.username || "").trim();
    const email = (user.email || "").trim().toLowerCase();
    if (!email || !name) {
      return res.status(400).json({ error: "MISSING_CUSTOMER_DATA", message: "Se requiere nombre y email para crear el cliente de pago" });
    }

    const customer = await createFlowCustomer({ name, email, externalId: userId });
    customerId = customer.customerId;

    await prisma.user.update({
      where: { id: userId },
      data: { flowCustomerId: customerId }
    });
  }

  // 2) Create Flow subscription
  const planId = req.body?.planId || config.flowPlanId;
  const { subscription_start, couponId, trial_period_days } = req.body || {};

  const subscription = await createFlowSubscription({
    planId,
    customerId,
    subscription_start,
    couponId,
    trial_period_days: trial_period_days !== undefined ? Number(trial_period_days) : undefined
  });

  // 3) Store subscriptionId (membership activates via webhook)
  await prisma.user.update({
    where: { id: userId },
    data: { flowSubscriptionId: subscription.subscriptionId }
  });

  console.log("[billing] Flow subscription created", { userId, subscriptionId: subscription.subscriptionId, planId });
  return res.json({ subscriptionId: subscription.subscriptionId, subscription });
}));

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
      flowSubscriptionId: true,
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

  // Check Flow subscription status if available
  let flowSubscriptionStatus: string | null = null;
  if (user.flowSubscriptionId) {
    try {
      const flowSub = await getFlowSubscription(user.flowSubscriptionId);
      const FLOW_ACTIVE = 1;
      const FLOW_CANCELED = 4;
      flowSubscriptionStatus = flowSub.status === FLOW_ACTIVE ? "active"
        : flowSub.status === FLOW_CANCELED ? "canceled"
        : "inactive";
    } catch {
      // Flow API unreachable or subscription not found — don't block the response
      flowSubscriptionStatus = null;
    }
  }

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
    recentPayments,
    flowSubscriptionId: user.flowSubscriptionId || null,
    flowSubscriptionStatus
  });
}));
