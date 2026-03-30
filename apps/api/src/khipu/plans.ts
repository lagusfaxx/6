import crypto from "crypto";
import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";
import { prisma } from "../db";
import {
  createFlowPlan,
  getFlowPlan,
  editFlowPlan,
  deleteFlowPlan,
  listFlowPlans,
  createFlowCustomer,
  createFlowSubscription,
  getFlowSubscription,
  getFlowPaymentStatus,
  signFlowParams
} from "./client";

export const plansRouter = Router();

/** POST /plans/create */
plansRouter.post("/plans/create", requireAuth, asyncHandler(async (req, res) => {
  const { planId, name, currency, amount, interval, interval_count, trial_period_days, days_until_due, periods_number, urlCallback, charges_retries_number, currency_convert_option } = req.body;

  if (!planId || !name || amount === undefined || interval === undefined) {
    return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", required: ["planId", "name", "amount", "interval"] });
  }

  const plan = await createFlowPlan({
    planId,
    name,
    currency,
    amount: Number(amount),
    interval: Number(interval),
    interval_count: interval_count !== undefined ? Number(interval_count) : undefined,
    trial_period_days: trial_period_days !== undefined ? Number(trial_period_days) : undefined,
    days_until_due: days_until_due !== undefined ? Number(days_until_due) : undefined,
    periods_number: periods_number !== undefined ? Number(periods_number) : undefined,
    urlCallback: urlCallback || config.flowCallbackUrl || undefined,
    charges_retries_number: charges_retries_number !== undefined ? Number(charges_retries_number) : undefined,
    currency_convert_option: currency_convert_option !== undefined ? Number(currency_convert_option) : undefined
  });

  return res.json(plan);
}));

/**
 * POST /plans/setup – One-time convenience endpoint to create the standard UZEED plan in Flow.
 *
 * Uses config defaults:
 *   planId        = FLOW_PLAN_ID  (default: UZEED_PRO_MENSUAL)
 *   amount        = MEMBERSHIP_PRICE_CLP (default: 4990)
 *   interval      = 3 (monthly)
 *   urlCallback   = FLOW_CALLBACK_URL
 *
 * Call this ONCE to register the plan in Flow, then use /customer/create + /subscription/create.
 */
plansRouter.post("/plans/setup", requireAdmin, asyncHandler(async (req, res) => {
  const planId = req.body.planId || config.flowPlanId;
  const name = req.body.name || "Plan Profesional UZEED";
  const amount = req.body.amount !== undefined ? Number(req.body.amount) : config.membershipPriceClp;
  const interval = req.body.interval !== undefined ? Number(req.body.interval) : 3; // 3 = monthly
  const urlCallback = req.body.urlCallback || config.flowCallbackUrl;
  const trial_period_days = req.body.trial_period_days !== undefined ? Number(req.body.trial_period_days) : config.freeTrialDays;

  const plan = await createFlowPlan({
    planId,
    name,
    currency: req.body.currency || "CLP",
    amount,
    interval,
    interval_count: 1,
    trial_period_days,
    days_until_due: 3,
    urlCallback: urlCallback || undefined
  });

  console.log("[flow] plan created via /plans/setup", { planId: plan.planId, amount, interval });
  return res.json(plan);
}));

/** GET /plans/get */
plansRouter.get("/plans/get", requireAuth, asyncHandler(async (req, res) => {
  const planId = req.query.planId as string | undefined;
  if (!planId) return res.status(400).json({ error: "MISSING_PLAN_ID" });

  const plan = await getFlowPlan(planId);
  return res.json(plan);
}));

/** POST /plans/edit */
plansRouter.post("/plans/edit", requireAuth, asyncHandler(async (req, res) => {
  const { planId, name, currency, amount, interval, interval_count, trial_period_days, days_until_due, periods_number, urlCallback, charges_retries_number, currency_convert_option } = req.body;

  if (!planId) return res.status(400).json({ error: "MISSING_PLAN_ID" });

  const plan = await editFlowPlan({
    planId,
    name,
    currency,
    amount: amount !== undefined ? Number(amount) : undefined,
    interval: interval !== undefined ? Number(interval) : undefined,
    interval_count: interval_count !== undefined ? Number(interval_count) : undefined,
    trial_period_days: trial_period_days !== undefined ? Number(trial_period_days) : undefined,
    days_until_due: days_until_due !== undefined ? Number(days_until_due) : undefined,
    periods_number: periods_number !== undefined ? Number(periods_number) : undefined,
    urlCallback,
    charges_retries_number: charges_retries_number !== undefined ? Number(charges_retries_number) : undefined,
    currency_convert_option: currency_convert_option !== undefined ? Number(currency_convert_option) : undefined
  });

  return res.json(plan);
}));

/** POST /plans/delete */
plansRouter.post("/plans/delete", requireAuth, asyncHandler(async (req, res) => {
  const planId = req.body?.planId as string | undefined;
  if (!planId) return res.status(400).json({ error: "MISSING_PLAN_ID" });

  const plan = await deleteFlowPlan(planId);
  return res.json(plan);
}));

/** GET /plans/list */
plansRouter.get("/plans/list", requireAuth, asyncHandler(async (req, res) => {
  const start = req.query.start !== undefined ? Number(req.query.start) : undefined;
  const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
  const filter = req.query.filter as string | undefined;
  const status = req.query.status !== undefined ? Number(req.query.status) : undefined;

  const result = await listFlowPlans({ start, limit, filter, status });
  return res.json(result);
}));

// ── Flow Customer ───────────────────────────────────────────────────

/** POST /customer/create – creates or reuses a Flow customer for the current user */
plansRouter.post("/customer/create", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, username: true, flowCustomerId: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // Prevent duplicate customer creation
  if (user.flowCustomerId) {
    return res.json({ customerId: user.flowCustomerId, reused: true });
  }

  const name = (req.body.name || user.displayName || user.username || "").trim();
  const email = (req.body.email || user.email || "").trim().toLowerCase();

  if (!email || !name) {
    return res.status(400).json({ error: "MISSING_CUSTOMER_DATA", message: "name and email are required" });
  }

  const customer = await createFlowCustomer({ name, email, externalId: userId });

  // Persist flowCustomerId
  await prisma.user.update({
    where: { id: userId },
    data: { flowCustomerId: customer.customerId }
  });

  return res.json(customer);
}));

// ── Flow Subscription ───────────────────────────────────────────────

/** POST /subscription/create – creates a Flow subscription (does NOT activate membership) */
plansRouter.post("/subscription/create", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const { subscription_start, couponId, trial_period_days } = req.body;
  const planId = req.body.planId || config.flowPlanId;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, flowCustomerId: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
  if (!user.flowCustomerId) {
    return res.status(400).json({ error: "CUSTOMER_NOT_CREATED", message: "Call /customer/create first" });
  }

  const subscription = await createFlowSubscription({
    planId,
    customerId: user.flowCustomerId,
    subscription_start,
    couponId,
    trial_period_days: trial_period_days !== undefined ? Number(trial_period_days) : undefined
  });

  // Store subscriptionId but do NOT activate membership yet — wait for webhook
  await prisma.user.update({
    where: { id: userId },
    data: { flowSubscriptionId: subscription.subscriptionId }
  });

  console.log("[flow] subscription created (pending confirmation)", { userId, subscriptionId: subscription.subscriptionId, planId });
  return res.json(subscription);
}));

/** GET /subscription/get */
plansRouter.get("/subscription/get", requireAuth, asyncHandler(async (req, res) => {
  const subscriptionId = req.query.subscriptionId as string | undefined;
  if (!subscriptionId) return res.status(400).json({ error: "MISSING_SUBSCRIPTION_ID" });

  const subscription = await getFlowSubscription(subscriptionId);
  return res.json(subscription);
}));

// ── Flow Webhook ────────────────────────────────────────────────────

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** POST /webhooks/flow/subscription – Flow subscription confirmation callback */
plansRouter.post("/webhooks/flow/subscription", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, string>;
  const { s, ...params } = body;

  // 1) Signature verification (timing-safe)
  if (!config.flowSecretKey) {
    console.error("[flow] webhook rejected: FLOW_SECRET_KEY not configured");
    return res.status(500).json({ error: "WEBHOOK_NOT_CONFIGURED" });
  }

  if (!s) {
    console.error("[flow] webhook rejected: missing signature");
    return res.status(401).json({ error: "MISSING_SIGNATURE" });
  }

  const expected = signFlowParams(params);
  try {
    const sigA = Buffer.from(expected, "hex");
    const sigB = Buffer.from(s, "hex");
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      console.error("[flow] webhook rejected: invalid signature");
      return res.status(401).json({ error: "INVALID_SIGNATURE" });
    }
  } catch {
    console.error("[flow] webhook rejected: malformed signature");
    return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  const { subscriptionId, status } = params;
  console.log("[flow] subscription webhook received", { subscriptionId, status });

  if (!subscriptionId) {
    return res.status(400).json({ error: "MISSING_SUBSCRIPTION_ID" });
  }

  // 2) Validate subscriptionId exists in our database
  const user = await prisma.user.findFirst({
    where: { flowSubscriptionId: subscriptionId },
    select: { id: true, membershipExpiresAt: true, flowSubscriptionId: true }
  });

  if (!user) {
    console.error("[flow] webhook: subscriptionId not found in database", { subscriptionId });
    return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
  }

  // Flow status 1 = active, 4 = canceled
  const flowStatus = Number(status);
  const isActive = flowStatus === 1;

  if (!isActive) {
    console.log("[flow] webhook: subscription not active", { subscriptionId, status: flowStatus });
    return res.json({ ok: true, subscriptionId, status: flowStatus, activated: false });
  }

  // Activate/extend membership inside a transaction
  // For PAC (recurring): Flow sends this webhook each billing cycle, so we must
  // ALWAYS extend the membership, even if it's currently active.
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: user.id },
      select: { membershipExpiresAt: true }
    });

    // Extend from current expiry if still active, otherwise from now
    const base = current?.membershipExpiresAt && current.membershipExpiresAt.getTime() > now.getTime()
      ? current.membershipExpiresAt
      : now;
    const expiresAt = addDays(base, config.membershipDays);

    await tx.user.update({
      where: { id: user.id },
      data: { membershipExpiresAt: expiresAt }
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        type: "SUBSCRIPTION_RENEWED",
        data: { subscriptionId, source: "flow_subscription", previousExpiry: current?.membershipExpiresAt?.toISOString() || null }
      }
    });

    return { extended: true, previousExpiry: current?.membershipExpiresAt, newExpiry: expiresAt };
  });

  console.log("[flow] membership extended via subscription webhook", {
    userId: user.id, subscriptionId,
    previousExpiry: result.previousExpiry?.toISOString() || null,
    newExpiry: result.newExpiry.toISOString()
  });
  return res.json({ ok: true, subscriptionId, status: flowStatus, activated: true });
}));

// ── Flow One-Time Payment Webhook ────────────────────────────────────────────

/** POST /webhooks/flow/payment – confirmation callback for one-time Flow payments */
plansRouter.post("/webhooks/flow/payment", asyncHandler(async (req, res) => {
  try {
    const body = (req.body || {}) as Record<string, any>;
    const query = (req.query || {}) as Record<string, any>;
    const token = String(body.token || query.token || body.tokenFlow || query.tokenFlow || "").trim();

    console.log("[flow webhook] body", body);
    console.log("[flow webhook] query", query);
    console.log("[flow webhook] token", token || "(missing)");

    // 1) Flow callback for payment confirmation only requires token.
    if (!token) {
      console.error("[flow] payment webhook: missing token");
      return res.status(200).send("OK");
    }

    // 2) Build internal Flow signature and fetch canonical payment status.
    const internalSignature = signFlowParams({ apiKey: config.flowApiKey, token });
    console.log("[flow webhook] internal signature generated", { hasSignature: Boolean(internalSignature) });

    // 3) Get payment status from Flow
    let payment;
    try {
      payment = await getFlowPaymentStatus(token);
    } catch (err) {
      console.error("[flow] payment webhook: failed to get payment status", err);
      return res.status(200).send("OK");
    }

    const statusMap: Record<number, "pending" | "paid" | "rejected" | "canceled"> = {
      1: "pending",
      2: "paid",
      3: "rejected",
      4: "canceled"
    };
    const flowStatus = statusMap[payment.status] ?? "pending";

    console.log("[flow webhook] flow status", { status: payment.status, mappedStatus: flowStatus });
    console.log("[flow webhook] commerceOrder", payment.commerceOrder || "(missing)");

    // status 2 = paid
    if (payment.status !== 2) {
      console.log("[flow] payment webhook: not paid", { token, status: payment.status });

      // Mark rejected/canceled payments as FAILED so the frontend can show proper state
      if (payment.status === 3 || payment.status === 4) {
        const commerceOrder = String(payment.commerceOrder || "").trim();
        const intentIdFromQuery = String(query.intentId || body.intentId || "").trim();
        const refFromQuery = String(query.ref || body.ref || "").trim();
        const candidates = Array.from(new Set([commerceOrder, intentIdFromQuery, refFromQuery].filter(Boolean)));

        const failedIntent = await prisma.paymentIntent.findFirst({
          where: {
            OR: [
              ...(candidates.length ? [{ id: { in: candidates } }] : []),
              { providerPaymentId: token }
            ],
            status: "PENDING",
          }
        });

        if (failedIntent) {
          await prisma.paymentIntent.update({
            where: { id: failedIntent.id },
            data: { status: "FAILED", providerPaymentId: token },
          });
          console.log("[flow webhook] payment marked as FAILED", { intentId: failedIntent.id, flowStatus });
        }
      }

      return res.status(200).send("OK");
    }

    // 4) Find PaymentIntent by commerceOrder / intentId / ref.
    const commerceOrder = String(payment.commerceOrder || "").trim();
    const intentIdFromQuery = String(query.intentId || body.intentId || "").trim();
    const refFromQuery = String(query.ref || body.ref || "").trim();
    const candidates = Array.from(new Set([commerceOrder, intentIdFromQuery, refFromQuery].filter(Boolean)));

    const intent = await prisma.paymentIntent.findFirst({
      where: {
        OR: [
          ...(candidates.length ? [{ id: { in: candidates } }] : []),
          { providerPaymentId: token }
        ]
      }
    });

    if (!intent) {
      console.error("[flow] payment webhook: intent not found", { commerceOrder, intentIdFromQuery, refFromQuery, token });
      return res.status(200).send("OK");
    }

    // Idempotency: already paid
    if (intent.status === "PAID") {
      console.log("[flow webhook] payment updated to PAID", { intentId: intent.id, idempotent: true });
      return res.status(200).send("OK");
    }

    // 5) Handle based on purpose
    if (intent.purpose === "TOKEN_PURCHASE") {
      // ── Auto-credit tokens for Flow token purchases ──
      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "PAID", paidAt: new Date(), providerPaymentId: token }
        });

        // Find the linked TokenDeposit
        const deposit = await tx.tokenDeposit.findUnique({
          where: { paymentIntentId: intent.id },
          include: { wallet: true },
        });

        if (deposit && deposit.status !== "APPROVED") {
          // Approve deposit and credit tokens automatically
          await tx.tokenDeposit.update({
            where: { id: deposit.id },
            data: { status: "APPROVED", reviewedAt: new Date() },
          });

          await tx.wallet.update({
            where: { id: deposit.walletId },
            data: { balance: { increment: deposit.amount } },
          });

          await tx.tokenTransaction.create({
            data: {
              walletId: deposit.walletId,
              type: "DEPOSIT",
              amount: deposit.amount,
              balance: deposit.wallet.balance + deposit.amount,
              referenceId: deposit.id,
              description: `Compra de ${deposit.amount} tokens (Flow)`,
            },
          });
        }

        await tx.notification.create({
          data: {
            userId: intent.subscriberId,
            type: "SUBSCRIPTION_RENEWED",
            data: { intentId: intent.id, source: "flow_token_purchase", tokens: deposit?.amount, flowOrder: payment.flowOrder, commerceOrder }
          }
        });
      });

      console.log("[flow webhook] token purchase completed", { userId: intent.subscriberId, intentId: intent.id, token });
    } else if (intent.purpose === "UMATE_PLAN") {
      // ── U-Mate plan subscription ──
      const notes = JSON.parse(intent.notes || "{}");
      const planId = notes.planId;

      if (!planId) {
        console.error("[flow webhook] UMATE_PLAN missing planId in notes", { intentId: intent.id });
        return res.status(200).send("OK");
      }

      const plan = await prisma.umatePlan.findUnique({ where: { id: planId } });
      if (!plan) {
        console.error("[flow webhook] UMATE_PLAN plan not found", { planId });
        return res.status(200).send("OK");
      }

      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "PAID", paidAt: new Date(), providerPaymentId: token }
        });

        // Check if user already has an active subscription (idempotency)
        const existingSub = await tx.umateSubscription.findFirst({
          where: { paymentIntentId: intent.id },
        });

        if (!existingSub) {
          const now = new Date();
          const cycleEnd = new Date(now);
          cycleEnd.setMonth(cycleEnd.getMonth() + 1);

          await tx.umateSubscription.create({
            data: {
              userId: intent.subscriberId,
              planId: plan.id,
              status: "ACTIVE",
              slotsTotal: plan.maxSlots,
              slotsUsed: 0,
              cycleStart: now,
              cycleEnd,
              paymentIntentId: intent.id,
            },
          });

          // Ledger entry for plan purchase
          await tx.umateLedgerEntry.create({
            data: {
              type: "PLAN_PURCHASE",
              grossAmount: plan.priceCLP,
              netAmount: plan.priceCLP,
              description: `Plan ${plan.name} (${plan.tier}) — Suscripción mensual`,
              referenceId: intent.id,
              referenceType: "payment_intent",
            },
          });
        }

        await tx.notification.create({
          data: {
            userId: intent.subscriberId,
            type: "UMATE_PLAN_ACTIVATED",
            data: { intentId: intent.id, planId: plan.id, tier: plan.tier, planName: plan.name }
          }
        });
      });

      console.log("[flow webhook] UMATE_PLAN activated", { userId: intent.subscriberId, intentId: intent.id, planId, tier: plan.tier });
    } else {
      // ── Membership payment (existing behavior) ──
      await prisma.$transaction(async (tx) => {
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "PAID", paidAt: new Date(), providerPaymentId: token }
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
            data: { intentId: intent.id, source: "flow_payment", flowOrder: payment.flowOrder, commerceOrder }
          }
        });
      });

      console.log("[flow webhook] membership payment updated to PAID", { userId: intent.subscriberId, intentId: intent.id, token, status: payment.status });
    }
    return res.status(200).send("OK");
  } catch (err) {
    console.error("[flow webhook] unexpected error", err);
    return res.status(200).send("OK");
  }
}));
