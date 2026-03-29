import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createFlowCustomer,
  createFlowSubscription,
  getFlowSubscription,
  cancelFlowSubscription,
  createFlowPayment
} from "../khipu/client";

export const billingRouter = Router();

// Public payment status by intent reference (used by /pago/exitoso after Flow return)
billingRouter.get("/billing/status", asyncHandler(async (req, res) => {
  const ref = String(req.query.ref || "").trim();
  if (!ref) {
    return res.json({ status: "error", paid: false, reason: "MISSING_REF" });
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: ref },
    select: { id: true, status: true, paidAt: true, amount: true, createdAt: true }
  });

  if (!intent) {
    return res.json({ status: "error", paid: false, reason: "INTENT_NOT_FOUND" });
  }

  if (intent.status === "PAID") {
    return res.json({ status: "paid", paid: true, intent });
  }

  return res.json({ status: "pending", paid: false, intent });
}));

// ── Flow one-time payment ──────────────────────────────────────────────────────

billingRouter.post("/billing/payment/flow", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, username: true, profileType: true, membershipExpiresAt: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED", message: "Este tipo de perfil no requiere suscripción" });
  }

  // Prevent duplicate payment if membership is still active (more than 3 days remaining)
  const now = new Date();
  if (user.membershipExpiresAt) {
    const msRemaining = user.membershipExpiresAt.getTime() - now.getTime();
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
    if (daysRemaining > 3) {
      return res.status(400).json({
        error: "MEMBERSHIP_STILL_ACTIVE",
        message: `Tu plan está activo hasta el ${user.membershipExpiresAt.toLocaleDateString("es-CL")}. Puedes renovar cuando falten 3 días o menos.`,
        membershipExpiresAt: user.membershipExpiresAt.toISOString(),
        daysRemaining: Math.ceil(daysRemaining)
      });
    }
  }

  // Check for recent pending payment to avoid creating duplicate intents
  const recentPending = await prisma.paymentIntent.findFirst({
    where: {
      subscriberId: userId,
      purpose: "MEMBERSHIP_PLAN",
      method: "FLOW",
      status: "PENDING",
      createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) } // last 30 minutes
    }
  });
  if (recentPending) {
    return res.status(400).json({
      error: "PAYMENT_ALREADY_PENDING",
      message: "Ya tienes un pago en proceso. Espera unos minutos o intenta de nuevo más tarde.",
      intentId: recentPending.id
    });
  }

  const email = (user.email || "").trim().toLowerCase();
  if (!email) return res.status(400).json({ error: "EMAIL_REQUIRED", message: "Se requiere email para procesar el pago" });

  if (!config.flowApiKey) {
    return res.status(503).json({ error: "PAYMENT_UNAVAILABLE", message: "El pago con Flow no está configurado" });
  }

  // Create pending PaymentIntent first
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "MEMBERSHIP_PLAN",
      method: "FLOW",
      status: "PENDING",
      amount: config.membershipPriceClp
    }
  });

  const appUrl = config.appUrl.replace(/\/$/, "");
  const apiUrl = config.apiUrl.replace(/\/$/, "");

  // Create Flow payment
  const payment = await createFlowPayment({
    commerceOrder: intent.id,
    subject: "Suscripción mensual profesional",
    currency: "CLP",
    amount: config.membershipPriceClp,
    email,
    urlConfirmation: `${apiUrl}/webhooks/flow/payment`,
    urlReturn: `${appUrl}/pago/exitoso?ref=${intent.id}`
  });

  // Store token
  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { paymentUrl: payment.url, providerPaymentId: payment.token }
  });

  // Full redirect URL for Flow payment page
  const redirectUrl = `${payment.url}?token=${payment.token}`;

  console.log("[billing] Flow payment created", { userId, intentId: intent.id, token: payment.token });
  return res.json({ url: redirectUrl, token: payment.token, intentId: intent.id });
}));

// ── Bank transfer payment submission ──────────────────────────────────────────

billingRouter.post("/billing/payment/transfer", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const { folio, bank, notes } = req.body;

  if (!folio) return res.status(400).json({ error: "FOLIO_REQUIRED", message: "Debes ingresar el número de folio o comprobante de la transferencia" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profileType: true, membershipExpiresAt: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED" });
  }

  // Prevent duplicate payment if membership is still active (more than 3 days remaining)
  const now = new Date();
  if (user.membershipExpiresAt) {
    const msRemaining = user.membershipExpiresAt.getTime() - now.getTime();
    const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
    if (daysRemaining > 3) {
      return res.status(400).json({
        error: "MEMBERSHIP_STILL_ACTIVE",
        message: `Tu plan está activo hasta el ${user.membershipExpiresAt.toLocaleDateString("es-CL")}. Puedes renovar cuando falten 3 días o menos.`,
        membershipExpiresAt: user.membershipExpiresAt.toISOString(),
        daysRemaining: Math.ceil(daysRemaining)
      });
    }
  }

  const notesParts: string[] = [];
  if (bank) notesParts.push(`Banco: ${bank}`);
  notesParts.push(`Folio/ref: ${folio}`);
  if (notes) notesParts.push(notes);

  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "MEMBERSHIP_PLAN",
      method: "TRANSFER",
      status: "PENDING",
      amount: config.membershipPriceClp,
      providerPaymentId: String(folio).trim(),
      notes: notesParts.join(" | ").slice(0, 500)
    }
  });

  console.log("[billing] bank transfer submitted", { userId, intentId: intent.id, folio });
  return res.json({ ok: true, intentId: intent.id, message: "Tu comprobante fue enviado. El equipo lo revisará en 24 horas hábiles." });
}));

// ── Admin: list pending transfers ──────────────────────────────────────────────

billingRouter.get("/admin/billing/transfers", requireAdmin, asyncHandler(async (_req, res) => {
  const transfers = await prisma.paymentIntent.findMany({
    where: { method: "TRANSFER", status: "PENDING", purpose: "MEMBERSHIP_PLAN" },
    include: {
      subscriber: {
        select: { id: true, username: true, email: true, displayName: true, profileType: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  return res.json(transfers);
}));

// ── Admin: approve transfer ────────────────────────────────────────────────────

billingRouter.post("/admin/billing/transfers/:id/approve", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.session.userId!;

  const intent = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!intent) return res.status(404).json({ error: "NOT_FOUND" });
  if (intent.method !== "TRANSFER") return res.status(400).json({ error: "NOT_A_TRANSFER" });
  if (intent.status === "PAID") return res.json({ ok: true, idempotent: true });

  function addDays(base: Date, days: number): Date {
    const d = new Date(base.getTime());
    d.setUTCDate(d.getUTCDate() + days);
    return d;
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentIntent.update({
      where: { id },
      data: { status: "PAID", paidAt: new Date(), reviewedBy: adminId, reviewedAt: new Date() }
    });

    const now = new Date();
    const current = await tx.user.findUnique({
      where: { id: intent.subscriberId },
      select: { membershipExpiresAt: true }
    });

    const base = current?.membershipExpiresAt && current.membershipExpiresAt.getTime() > now.getTime()
      ? current.membershipExpiresAt
      : now;
    const expiresAt = addDays(base, config.membershipDays);

    await tx.user.update({
      where: { id: intent.subscriberId },
      data: { membershipExpiresAt: expiresAt }
    });

    await tx.notification.create({
      data: {
        userId: intent.subscriberId,
        type: "SUBSCRIPTION_RENEWED",
        data: { intentId: intent.id, source: "transfer", approvedBy: adminId }
      }
    });
  });

  console.log("[admin] transfer approved", { intentId: id, userId: intent.subscriberId, adminId });
  return res.json({ ok: true, intentId: id });
}));

// ── Admin: reject transfer ─────────────────────────────────────────────────────

billingRouter.post("/admin/billing/transfers/:id/reject", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.session.userId!;
  const { reason } = req.body;

  const intent = await prisma.paymentIntent.findUnique({ where: { id } });
  if (!intent) return res.status(404).json({ error: "NOT_FOUND" });
  if (intent.status !== "PENDING") return res.status(400).json({ error: "NOT_PENDING" });

  await prisma.paymentIntent.update({
    where: { id },
    data: {
      status: "FAILED",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      notes: intent.notes ? `${intent.notes} | RECHAZADO: ${reason || "Sin motivo"}` : `RECHAZADO: ${reason || "Sin motivo"}`
    }
  });

  console.log("[admin] transfer rejected", { intentId: id, userId: intent.subscriberId, adminId, reason });
  return res.json({ ok: true, intentId: id });
}));

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

// ── Cancel Flow subscription (PAC) ──────────────────────────────────────────

billingRouter.post("/billing/subscription/cancel", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, flowSubscriptionId: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
  if (!user.flowSubscriptionId) {
    return res.status(400).json({ error: "NO_SUBSCRIPTION", message: "No tienes una suscripción activa para cancelar" });
  }

  try {
    // Cancel at period end so the user keeps access until expiry
    await cancelFlowSubscription(user.flowSubscriptionId, true);
  } catch (err: any) {
    console.error("[billing] cancel subscription failed", { userId, subscriptionId: user.flowSubscriptionId, error: err.message });
    return res.status(500).json({ error: "CANCEL_FAILED", message: "No se pudo cancelar la suscripción. Intenta de nuevo." });
  }

  console.log("[billing] subscription canceled", { userId, subscriptionId: user.flowSubscriptionId });
  return res.json({ ok: true, message: "Tu suscripción se canceló. Mantendrás acceso hasta el fin del periodo actual." });
}));
