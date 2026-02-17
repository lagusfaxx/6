import crypto from "crypto";
import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createFlowPayment,
  getFlowPaymentStatus
} from "../khipu/client";

export const billingRouter = Router();

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ── Flow manual payment (generates a payment link for the user) ─────

billingRouter.post("/billing/payment/create", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      username: true,
      profileType: true
    }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED", message: "Este tipo de perfil no requiere pago" });
  }

  const email = (user.email || "").trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: "MISSING_EMAIL", message: "Se requiere email para generar el pago" });
  }

  const amount = config.membershipPriceClp;
  const commerceOrder = crypto.randomUUID();

  const flowResponse = await createFlowPayment({
    commerceOrder,
    subject: `Membresía mensual UZEED – ${user.displayName || user.username}`,
    currency: "CLP",
    amount,
    email,
    urlConfirmation: config.flowUrlConfirmation,
    urlReturn: config.flowUrlReturn,
    optional: JSON.stringify({ userId })
  });

  // Store the payment in our database
  await prisma.payment.create({
    data: {
      userId,
      providerPaymentId: String(flowResponse.flowOrder),
      transactionId: commerceOrder,
      amount,
      currency: "CLP",
      status: "PENDING",
      paymentUrl: `${flowResponse.url}?token=${flowResponse.token}`
    }
  });

  console.log("[billing] Flow manual payment created", { userId, commerceOrder, flowOrder: flowResponse.flowOrder });
  return res.json({
    paymentUrl: `${flowResponse.url}?token=${flowResponse.token}`,
    commerceOrder,
    flowOrder: flowResponse.flowOrder
  });
}));

// ── Flow payment webhook (confirmation callback) ────────────────────

billingRouter.post("/billing/webhooks/flow/payment", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, string>;
  const token = body.token;

  if (!token) {
    console.error("[flow] payment webhook rejected: missing token");
    return res.status(400).json({ error: "MISSING_TOKEN" });
  }

  // Query Flow for the payment status using the token
  const flowPayment = await getFlowPaymentStatus(token);
  console.log("[flow] payment webhook received", { flowOrder: flowPayment.flowOrder, status: flowPayment.status, commerceOrder: flowPayment.commerceOrder });

  // Flow status: 1=pending, 2=paid, 3=rejected, 4=canceled
  if (flowPayment.status !== 2) {
    console.log("[flow] payment not paid yet", { flowOrder: flowPayment.flowOrder, status: flowPayment.status });
    return res.json({ ok: true, status: flowPayment.status, activated: false });
  }

  // Find the local payment by commerceOrder (transactionId)
  const localPayment = await prisma.payment.findFirst({
    where: { transactionId: flowPayment.commerceOrder }
  });

  if (!localPayment) {
    console.error("[flow] payment webhook: commerceOrder not found", { commerceOrder: flowPayment.commerceOrder });
    return res.status(404).json({ error: "PAYMENT_NOT_FOUND" });
  }

  // Idempotency: if already paid, acknowledge
  if (localPayment.status === "PAID") {
    return res.json({ ok: true, status: flowPayment.status, activated: false, reason: "ALREADY_PAID" });
  }

  // Activate membership inside a transaction
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: localPayment.id },
      data: { status: "PAID", paidAt: now }
    });

    const user = await tx.user.findUnique({
      where: { id: localPayment.userId },
      select: { membershipExpiresAt: true }
    });

    const base = user?.membershipExpiresAt && user.membershipExpiresAt.getTime() > now.getTime()
      ? user.membershipExpiresAt
      : now;
    const expiresAt = addDays(base, config.membershipDays);

    await tx.user.update({
      where: { id: localPayment.userId },
      data: { membershipExpiresAt: expiresAt }
    });

    await tx.notification.create({
      data: {
        userId: localPayment.userId,
        type: "SUBSCRIPTION_RENEWED",
        data: { commerceOrder: flowPayment.commerceOrder, source: "flow_manual" }
      }
    });
  });

  console.log("[flow] membership activated via manual payment webhook", { userId: localPayment.userId, commerceOrder: flowPayment.commerceOrder });
  return res.json({ ok: true, status: flowPayment.status, activated: true });
}));

// ── Get subscription status for current user ────────────────────────

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

  // Calculate next payment date
  let nextPaymentDate: string | null = null;
  if (membershipActive && user.membershipExpiresAt) {
    nextPaymentDate = user.membershipExpiresAt.toISOString();
  } else if (trialActive && user.shopTrialEndsAt) {
    nextPaymentDate = user.shopTrialEndsAt.toISOString();
  }

  // Get recent payments from the Payment table
  const recentPayments = await prisma.payment.findMany({
    where: { userId },
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
    nextPaymentDate,
    profileType: user.profileType,
    subscriptionPrice: config.membershipPriceClp,
    recentPayments
  });
}));
