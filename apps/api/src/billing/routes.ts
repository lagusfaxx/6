import { Router } from "express";
import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import {
  createFlowCustomer,
  registerFlowCustomer,
  getFlowRegisterStatus,
  createFlowSubscription,
  getFlowSubscription,
  listFlowSubscriptions,
  cancelFlowSubscription,
  createFlowPayment,
  getFlowPaymentStatus,
} from "../khipu/client";

export const billingRouter = Router();

// Public payment status by intent reference (used by /pago/exitoso after Flow return)
billingRouter.get("/billing/status", asyncHandler(async (req, res) => {
  const ref = String(req.query.ref || "").trim();
  if (!ref) {
    return res.json({ status: "error", paid: false, reason: "MISSING_REF" });
  }

  // Check PaymentIntent first (regular payments)
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: ref },
    select: { id: true, status: true, paidAt: true, amount: true, createdAt: true, providerPaymentId: true }
  });

  if (intent) {
    if (intent.status === "PAID") return res.json({ status: "paid", paid: true, intent });
    if (intent.status === "FAILED" || intent.status === "EXPIRED") return res.json({ status: "failed", paid: false, intent });

    // PENDING: actively check Flow
    if (intent.status === "PENDING" && intent.providerPaymentId) {
      try {
        const flowPayment = await getFlowPaymentStatus(intent.providerPaymentId);
        if (flowPayment.status === 3 || flowPayment.status === 4) {
          await prisma.paymentIntent.update({
            where: { id: intent.id },
            data: { status: "FAILED", providerPaymentId: intent.providerPaymentId },
          });
          return res.json({ status: "failed", paid: false });
        }
      } catch {
        // Flow check failed — fall through to pending
      }
    }
    return res.json({ status: "pending", paid: false, intent });
  }

  // Check PendingGoldRegistration (Gold plan — ref is pending ID)
  const pending = await prisma.pendingGoldRegistration.findUnique({ where: { id: ref } });
  if (pending) {
    if (pending.status === "PAID") return res.json({ status: "paid", paid: true });
    if (pending.status === "FAILED") return res.json({ status: "failed", paid: false });

    // PENDING: actively check Flow
    if (pending.status === "PENDING" && pending.flowToken) {
      try {
        const flowPayment = await getFlowPaymentStatus(pending.flowToken);
        if (flowPayment.status === 3 || flowPayment.status === 4) {
          await prisma.pendingGoldRegistration.update({
            where: { id: pending.id },
            data: { status: "FAILED" },
          });
          return res.json({ status: "failed", paid: false });
        }
      } catch {
        // Flow check failed
      }
    }
    return res.json({ status: "pending", paid: false });
  }

  return res.json({ status: "error", paid: false, reason: "INTENT_NOT_FOUND" });
}));

// ── Flow one-time payment ──────────────────────────────────────────────────────

billingRouter.post("/billing/payment/flow", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, username: true, profileType: true, membershipExpiresAt: true, shopTrialEndsAt: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED", message: "Este tipo de perfil no requiere suscripción" });
  }

  // Prevent duplicate payment if PAID membership is still active (more than 3 days remaining)
  // Allow payment if user is on free trial (even if membershipExpiresAt is set from legacy data)
  const now = new Date();
  const trialActive = user.shopTrialEndsAt ? user.shopTrialEndsAt.getTime() > now.getTime() : false;
  if (user.membershipExpiresAt && !trialActive) {
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

  console.log("[billing] Flow payment created", { userId, intentId: intent.id });
  return res.json({ url: redirectUrl, token: payment.token, intentId: intent.id });
}));

// ── Bank transfer payment submission ──────────────────────────────────────────

billingRouter.post("/billing/payment/transfer", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const { folio, bank, notes } = req.body;

  if (!folio) return res.status(400).json({ error: "FOLIO_REQUIRED", message: "Debes ingresar el número de folio o comprobante de la transferencia" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, profileType: true, membershipExpiresAt: true, shopTrialEndsAt: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED" });
  }

  // Prevent duplicate payment if PAID membership is still active (more than 3 days remaining)
  // Allow payment if user is on free trial
  const now = new Date();
  const trialActive = user.shopTrialEndsAt ? user.shopTrialEndsAt.getTime() > now.getTime() : false;
  if (user.membershipExpiresAt && !trialActive) {
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

  // Notify the user their transfer was rejected
  await prisma.notification.create({
    data: {
      userId: intent.subscriberId,
      type: "TRANSFER_REJECTED",
      data: { intentId: intent.id, reason: reason || "Sin motivo especificado" }
    }
  });

  console.log("[admin] transfer rejected", { intentId: id, userId: intent.subscriberId, adminId, reason });
  return res.json({ ok: true, intentId: id });
}));

// ── PAC Flow: Step 1 — Register card (creates customer + redirects to Flow card enrollment) ──

billingRouter.post("/billing/subscription/register-card", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, displayName: true, username: true,
      profileType: true, flowCustomerId: true
    }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED", message: "Este tipo de perfil no requiere suscripción" });
  }

  if (!config.flowApiKey) {
    return res.status(503).json({ error: "PAYMENT_UNAVAILABLE", message: "El pago con Flow no está configurado" });
  }

  const name = (user.displayName || user.username || "").trim();
  const email = (user.email || "").trim().toLowerCase();
  if (!email || !name) {
    return res.status(400).json({ error: "MISSING_CUSTOMER_DATA", message: "Se requiere nombre y email para crear el cliente de pago" });
  }

  // 1) Ensure Flow customer exists
  let customerId = user.flowCustomerId;

  if (!customerId) {
    const customer = await createFlowCustomer({ name, email, externalId: userId });
    customerId = customer.customerId;
    await prisma.user.update({
      where: { id: userId },
      data: { flowCustomerId: customerId }
    });
  }

  // 2) Try to register card; if "Customer not found", recreate customer and retry
  const appUrl = config.appUrl.replace(/\/$/, "");

  const tryRegister = async (custId: string): Promise<{ url: string; token: string }> => {
    // Get registration token from Flow.
    // We embed the token in url_return so the frontend can read it via useSearchParams(),
    // since Flow may POST the token in the body only (not as query param).
    // The url_return is where Flow redirects the user AFTER card enrollment.
    const returnBase = `${appUrl}/pago/tarjeta-registrada`;
    const registration = await registerFlowCustomer(custId, returnBase);
    return {
      url: `${registration.url}?token=${registration.token}`,
      token: registration.token
    };
  };

  let result;
  try {
    result = await tryRegister(customerId);
  } catch (err: any) {
    // If "Customer not found" (code 7002), the stored customerId is stale — recreate
    if (err?.payload?.code === 7002 || err?.message?.includes("7002") || err?.message?.includes("Customer not found")) {
      console.log("[billing] stale flowCustomerId, recreating customer", { userId, oldCustomerId: customerId });
      const customer = await createFlowCustomer({ name, email, externalId: userId });
      customerId = customer.customerId;
      await prisma.user.update({
        where: { id: userId },
        data: { flowCustomerId: customerId, flowSubscriptionId: null } // also clear stale subscription
      });
      result = await tryRegister(customerId);
    } else {
      throw err;
    }
  }

  console.log("[billing] card registration started", { userId, customerId });
  return res.json(result);
}));

// ── PAC Flow: Step 2 — Check card registration status ────────────────────────

billingRouter.get("/billing/subscription/register-status", requireAuth, asyncHandler(async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) return res.status(400).json({ error: "MISSING_TOKEN" });

  const rawStatus = await getFlowRegisterStatus(token);
  console.log("[billing] getRegisterStatus response", JSON.stringify(rawStatus));

  // Flow may return status as number or string. Normalize.
  const statusNum = Number(rawStatus.status);
  // status: 0=pending, 1=registered, 2=rejected
  const registered = statusNum === 1;

  // Save card info to user when card is registered (may fail if migration hasn't run)
  if (registered && (rawStatus.creditCardType || rawStatus.last4CardDigits)) {
    const userId = req.session.userId!;
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          flowCardType: rawStatus.creditCardType || null,
          flowCardLast4: rawStatus.last4CardDigits || null,
        }
      });
    } catch {
      // Migration for card fields hasn't run yet — skip
    }
  }

  return res.json({
    registered,
    status: statusNum,
    creditCardType: rawStatus.creditCardType || null,
    last4CardDigits: rawStatus.last4CardDigits || null,
    customerId: rawStatus.customerId
  });
}));

// ── PAC Flow: Step 3 — Create subscription (only after card is registered) ───

billingRouter.post("/billing/subscription/start", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, profileType: true, flowCustomerId: true, flowSubscriptionId: true
    }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  if (!["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(user.profileType)) {
    return res.status(400).json({ error: "NOT_REQUIRED", message: "Este tipo de perfil no requiere suscripción" });
  }

  if (!user.flowCustomerId) {
    return res.status(400).json({ error: "CARD_NOT_REGISTERED", message: "Primero debes registrar tu tarjeta. Usa /billing/subscription/register-card" });
  }

  // If already has an active subscription, don't create another
  if (user.flowSubscriptionId) {
    try {
      const existing = await getFlowSubscription(user.flowSubscriptionId);
      if (Number(existing.status) === 1) { // 1 = active
        return res.status(400).json({ error: "SUBSCRIPTION_ALREADY_ACTIVE", message: "Ya tienes una suscripción activa" });
      }
    } catch {
      // Subscription not found in Flow — allow creating a new one
    }
  }

  const planId = config.flowPlanId;

  let subscription;
  try {
    subscription = await createFlowSubscription({
      planId,
      customerId: user.flowCustomerId,
    });
  } catch (err: any) {
    // If "Customer not found" (7002), the stored customerId is stale
    if (err?.payload?.code === 7002 || err?.message?.includes("7002") || err?.message?.includes("Customer not found")) {
      console.error("[billing] stale flowCustomerId in /start, cannot auto-fix — user must re-register card", { userId });
      return res.status(400).json({ error: "CARD_NOT_REGISTERED", message: "Tu tarjeta ya no está registrada. Debes registrarla nuevamente." });
    }
    throw err;
  }

  // Check subscription status from Flow to determine activation
  let flowSubStatus = 0; // 0=trial/created, 1=active (charged), 2=past_due, 3=cancelled
  let trialEnd: Date | null = null;
  try {
    const subDetails = await getFlowSubscription(subscription.subscriptionId);
    flowSubStatus = Number(subDetails.status);
    if (subDetails.trial_end) {
      trialEnd = new Date(subDetails.trial_end);
    }
  } catch {
    // Could not verify — don't activate, wait for webhook
  }

  function addDays(d: Date, days: number): Date {
    const r = new Date(d.getTime());
    r.setUTCDate(r.getUTCDate() + days);
    return r;
  }

  const now = new Date();

  if (flowSubStatus === 1) {
    // Status 1 = active: Flow already charged successfully.
    // Safe to activate full membership period.
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { membershipExpiresAt: true }
      });

      const base = current?.membershipExpiresAt && current.membershipExpiresAt.getTime() > now.getTime()
        ? current.membershipExpiresAt
        : now;
      const expiresAt = addDays(base, config.membershipDays);

      await tx.user.update({
        where: { id: userId },
        data: { flowSubscriptionId: subscription.subscriptionId, membershipExpiresAt: expiresAt }
      });

      await tx.notification.create({
        data: {
          userId,
          type: "SUBSCRIPTION_RENEWED",
          data: { subscriptionId: subscription.subscriptionId, source: "flow_pac_charged" }
        }
      });
    });

    console.log("[billing] Flow PAC subscription active (charged) — full membership activated", { userId, subscriptionId: subscription.subscriptionId });
  } else if (flowSubStatus === 0 && trialEnd) {
    // Status 0 with trial: subscription in trial period.
    // Only grant access until trial ends — full membership activates via webhook
    // when Flow successfully charges after trial.
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { membershipExpiresAt: true }
      });

      // Only set trial expiry if user doesn't already have a longer membership
      const currentExpiry = current?.membershipExpiresAt?.getTime() ?? 0;
      if (trialEnd!.getTime() > currentExpiry) {
        await tx.user.update({
          where: { id: userId },
          data: { flowSubscriptionId: subscription.subscriptionId, membershipExpiresAt: trialEnd }
        });
      } else {
        await tx.user.update({
          where: { id: userId },
          data: { flowSubscriptionId: subscription.subscriptionId }
        });
      }

      await tx.notification.create({
        data: {
          userId,
          type: "SUBSCRIPTION_RENEWED",
          data: { subscriptionId: subscription.subscriptionId, source: "flow_pac_trial", trialEnd: trialEnd!.toISOString() }
        }
      });
    });

    console.log("[billing] Flow PAC subscription in trial — access until trial end", { userId, subscriptionId: subscription.subscriptionId, trialEnd: trialEnd.toISOString() });
  } else {
    // Status 0 without trial, or status 2/3/4 — just save subscription ID.
    // Full activation happens when Flow webhook confirms payment.
    await prisma.user.update({
      where: { id: userId },
      data: { flowSubscriptionId: subscription.subscriptionId }
    });

    console.log("[billing] Flow PAC subscription created — waiting for webhook confirmation", { userId, subscriptionId: subscription.subscriptionId, flowSubStatus });
  }

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
      flowCustomerId: true,
      flowSubscriptionId: true,
      createdAt: true
    }
  });

  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // Try to get card info (may fail if migration hasn't run yet)
  let flowCardType: string | null = null;
  let flowCardLast4: string | null = null;
  try {
    const cardInfo = await prisma.user.findUnique({
      where: { id: userId },
      select: { flowCardType: true, flowCardLast4: true }
    });
    flowCardType = cardInfo?.flowCardType || null;
    flowCardLast4 = cardInfo?.flowCardLast4 || null;
  } catch {
    // Migration hasn't run yet — skip card info
  }

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

  // Legacy fix: users registered before the trial fix have membershipExpiresAt set
  // but no shopTrialEndsAt. Detect them by checking if they ever had a PAID payment.
  const hasPaidPayment = await prisma.paymentIntent.count({
    where: {
      subscriberId: userId,
      purpose: { in: ["MEMBERSHIP_PLAN", "SHOP_PLAN"] },
      status: "PAID",
    },
  });
  const isLegacyTrial = membershipActive && !trialActive && hasPaidPayment === 0;
  const effectiveTrialActive = trialActive || isLegacyTrial;
  const effectiveMembershipActive = isLegacyTrial ? false : membershipActive;
  const isActive = effectiveMembershipActive || effectiveTrialActive;

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

  // If flowSubscriptionId is missing but flowCustomerId exists, try to find subscription in Flow
  let resolvedSubscriptionId = user.flowSubscriptionId;
  if (!resolvedSubscriptionId && user.flowCustomerId && config.flowPlanId) {
    try {
      const subs = await listFlowSubscriptions({ planId: config.flowPlanId, status: 1 });
      const activeSub = subs.data?.find((s) => s.customerId === user.flowCustomerId);
      if (activeSub) {
        console.log("[billing] found Flow subscription via list fallback", { userId, subscriptionId: activeSub.subscriptionId, customerId: user.flowCustomerId });
        resolvedSubscriptionId = activeSub.subscriptionId;
        // Store it so we don't need the fallback next time
        await prisma.user.update({
          where: { id: userId },
          data: { flowSubscriptionId: activeSub.subscriptionId }
        });
      }
    } catch (err: any) {
      console.error("[billing] subscription list fallback failed", { error: err?.message });
    }
  }

  // Check Flow subscription status if available
  let flowSubscriptionStatus: string | null = null;
  if (resolvedSubscriptionId) {
    try {
      const flowSub = await getFlowSubscription(resolvedSubscriptionId);
      const statusNum = Number(flowSub.status);
      // Flow statuses: 0=created/trial, 1=active, 2=past_due, 3=cancelled, 4=completed
      // Only 3 (cancelled) and 4 (completed) mean PAC is truly off.
      // 0 (trial), 1 (active), 2 (past_due) all mean the subscription is still alive.
      flowSubscriptionStatus = (statusNum === 3 || statusNum === 4) ? "canceled" : "active";
    } catch (err: any) {
      console.error("[billing] getFlowSubscription failed, assuming active", { subscriptionId: resolvedSubscriptionId, error: err?.message });
      // Fail-open: if we have a subscriptionId stored, assume it's active
      // rather than hiding PAC status due to a transient API error
      flowSubscriptionStatus = "active";
    }
  }

  return res.json({
    requiresPayment: true,
    isActive,
    membershipActive: effectiveMembershipActive,
    trialActive: effectiveTrialActive,
    daysRemaining,
    membershipExpiresAt: user.membershipExpiresAt?.toISOString() || null,
    shopTrialEndsAt: user.shopTrialEndsAt?.toISOString() || null,
    profileType: user.profileType,
    subscriptionPrice: config.membershipPriceClp,
    recentPayments,
    flowCustomerId: user.flowCustomerId || null,
    flowSubscriptionId: resolvedSubscriptionId || null,
    flowSubscriptionStatus,
    flowCardType,
    flowCardLast4,
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
    // If already canceled or not found, treat as success (idempotent)
    const errMsg = err?.message || "";
    const alreadyCanceled = errMsg.includes("canceled") || errMsg.includes("cancelled") || err?.payload?.code === 7003;
    if (!alreadyCanceled) {
      console.error("[billing] cancel subscription failed", { userId, subscriptionId: user.flowSubscriptionId, error: errMsg });
      return res.status(500).json({ error: "CANCEL_FAILED", message: "No se pudo cancelar la suscripción. Intenta de nuevo." });
    }
    console.log("[billing] subscription already canceled (idempotent)", { userId, subscriptionId: user.flowSubscriptionId });
  }

  console.log("[billing] subscription canceled", { userId, subscriptionId: user.flowSubscriptionId });
  return res.json({ ok: true, message: "Tu suscripción se canceló. Mantendrás acceso hasta el fin del periodo actual." });
}));
