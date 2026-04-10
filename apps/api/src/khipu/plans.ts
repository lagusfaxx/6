import crypto from "crypto";
import { Router } from "express";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";
import { prisma } from "../db";
import { createProfessionalUser } from "../auth/createProfessional";
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
plansRouter.post("/plans/create", requireAdmin, asyncHandler(async (req, res) => {
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
 * POST /plans/setup – Idempotent: creates or updates the standard UZEED plan in Flow.
 *
 * Uses config defaults from .env:
 *   planId        = FLOW_PLAN_ID  (default: UZEED_PRO_MENSUAL)
 *   amount        = MEMBERSHIP_PRICE_CLP (default: 4990)
 *   interval      = 3 (monthly)
 *   trial         = FREE_TRIAL_DAYS (default: 7)
 *   urlCallback   = API_URL/webhooks/flow/subscription
 *
 * If the plan already exists in Flow, it updates it with current .env values.
 * Call this after changing pricing in .env to sync with Flow.
 */
plansRouter.post("/plans/setup", requireAdmin, asyncHandler(async (req, res) => {
  const planId = req.body.planId || config.flowPlanId;
  const name = req.body.name || "Plan Profesional UZEED";
  const amount = req.body.amount !== undefined ? Number(req.body.amount) : config.membershipPriceClp;
  const interval = req.body.interval !== undefined ? Number(req.body.interval) : 3; // 3 = monthly
  const apiUrl = config.apiUrl.replace(/\/$/, "");
  const urlCallback = req.body.urlCallback || `${apiUrl}/webhooks/flow/subscription`;
  const trial_period_days = req.body.trial_period_days !== undefined ? Number(req.body.trial_period_days) : config.freeTrialDays;

  // Try to get existing plan first
  let existing = null;
  try {
    existing = await getFlowPlan(planId);
  } catch {
    // Plan doesn't exist yet — will create below
  }

  let plan;
  if (existing) {
    // Plan exists — update it with current .env values
    // Note: Flow only allows editing trial_period_days if plan has active subscribers
    plan = await editFlowPlan({
      planId,
      name,
      amount,
      currency: req.body.currency || "CLP",
      interval,
      interval_count: 1,
      trial_period_days,
      urlCallback: urlCallback || undefined
    });
    console.log("[flow] plan updated via /plans/setup", { planId: plan.planId, amount, interval, trial_period_days });
    return res.json({ ...plan, action: "updated" });
  }

  // Plan doesn't exist — create it
  plan = await createFlowPlan({
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

  console.log("[flow] plan created via /plans/setup", { planId: plan.planId, amount, interval, trial_period_days });
  return res.json({ ...plan, action: "created" });
}));

/** GET /plans/get */
plansRouter.get("/plans/get", requireAdmin, asyncHandler(async (req, res) => {
  const planId = req.query.planId as string | undefined;
  if (!planId) return res.status(400).json({ error: "MISSING_PLAN_ID" });

  const plan = await getFlowPlan(planId);
  return res.json(plan);
}));

/** POST /plans/edit */
plansRouter.post("/plans/edit", requireAdmin, asyncHandler(async (req, res) => {
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
plansRouter.post("/plans/delete", requireAdmin, asyncHandler(async (req, res) => {
  const planId = req.body?.planId as string | undefined;
  if (!planId) return res.status(400).json({ error: "MISSING_PLAN_ID" });

  const plan = await deleteFlowPlan(planId);
  return res.json(plan);
}));

/** GET /plans/list */
plansRouter.get("/plans/list", requireAdmin, asyncHandler(async (req, res) => {
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

/** Extend a U-Mate direct subscription by 30 days and credit the creator.
 *  Called from both branches of /webhooks/flow/subscription when Flow reports a
 *  successful recurring charge for an `UmateDirectSubscription`.
 *  Returns true if the subscription was found + processed. */
async function extendUmateDirectSubFromWebhook(flowSubscriptionId: string, source: string): Promise<boolean> {
  const umateSub = await prisma.umateDirectSubscription.findUnique({
    where: { flowSubscriptionId },
  });
  if (!umateSub) return false;

  const now = new Date();
  const base = umateSub.currentPeriodEnd && umateSub.currentPeriodEnd.getTime() > now.getTime()
    ? umateSub.currentPeriodEnd
    : now;
  const newPeriodStart = now;
  const newPeriodEnd = new Date(base.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Platform economics (same logic as initial subscription)
  const platformCfg = await prisma.platformConfig.findMany({
    where: { key: { in: ["umate_platform_commission_pct", "umate_iva_pct"] } },
  });
  const platformCommPct = Number(platformCfg.find((c) => c.key === "umate_platform_commission_pct")?.value ?? "15");
  const ivaPct = Number(platformCfg.find((c) => c.key === "umate_iva_pct")?.value ?? "19");

  const gross = umateSub.priceCLP;
  const ivaAmount = Math.round(gross * ivaPct / (100 + ivaPct));
  const netAfterIva = gross - ivaAmount;
  const platformFee = Math.round(netAfterIva * platformCommPct / 100);
  const creatorPayout = netAfterIva - platformFee;

  await prisma.$transaction(async (tx) => {
    // If the sub was cancelled but flow still charged (race), leave it cancelled — only
    // update the period so the user still has access until it ends.
    const isRenewal = umateSub.status === "ACTIVE";

    await tx.umateDirectSubscription.update({
      where: { id: umateSub.id },
      data: {
        currentPeriodStart: newPeriodStart,
        currentPeriodEnd: newPeriodEnd,
      },
    });

    if (isRenewal) {
      await tx.umateCreator.update({
        where: { id: umateSub.creatorId },
        data: {
          pendingBalance: { increment: creatorPayout },
          totalEarned: { increment: creatorPayout },
        },
      });

      await tx.umateLedgerEntry.create({
        data: {
          creatorId: umateSub.creatorId,
          type: "SLOT_ACTIVATION",
          grossAmount: gross,
          platformFee,
          ivaAmount,
          creatorPayout,
          netAmount: creatorPayout,
          description: `Renovación PAC — $${gross.toLocaleString("es-CL")} CLP`,
          referenceId: umateSub.id,
          referenceType: "direct_subscription",
        },
      });

      await tx.notification.create({
        data: {
          userId: umateSub.userId,
          type: "SUBSCRIPTION_RENEWED",
          data: { umateDirectSubscriptionId: umateSub.id, source },
        },
      });
    }
  });

  console.log("[umate] direct-sub period extended via webhook", {
    umateSubId: umateSub.id, flowSubscriptionId, newPeriodEnd: newPeriodEnd.toISOString(), source,
  });
  return true;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * POST /webhooks/flow/subscription – Flow subscription callback (urlCallback on Plan).
 *
 * Flow docs indicate two possible patterns for plan callbacks:
 *   A) Direct: subscriptionId + status + signature (subscription lifecycle events)
 *   B) Token-based: token param → call getFlowSubscription to get details
 * We handle both for maximum compatibility.
 */
plansRouter.post("/webhooks/flow/subscription", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, string>;
  const query = (req.query || {}) as Record<string, string>;

  console.log("[flow] subscription webhook received", { body, query });

  // ── Pattern B: token-based callback ──────────────────────────────────
  // Flow may send just a token; we fetch subscription details via API.
  const token = String(body.token || query.token || "").trim();
  if (token && !body.subscriptionId) {
    let subData;
    try {
      subData = await getFlowSubscription(token);
    } catch (err) {
      console.error("[flow] subscription webhook: failed to get subscription by token", { token, err });
      // Try treating token as a payment token and fetching payment status
      try {
        const paymentStatus = await getFlowPaymentStatus(token);
        console.log("[flow] subscription webhook: token resolved as payment", { token, status: paymentStatus.status });
        // If it's a paid payment, find the user's subscription via commerceOrder
        if (paymentStatus.status === 2) {
          // Delegate to the payment webhook handler by forwarding
          // For now, just log - the /webhooks/flow/payment handler should pick this up
          console.log("[flow] subscription webhook: paid payment token — should be handled by payment webhook", { token });
        }
      } catch {
        console.error("[flow] subscription webhook: token is not a valid subscription or payment", { token });
      }
      return res.status(200).send("OK");
    }

    // Found subscription — proceed to extend membership
    const subId = subData.subscriptionId;
    const subStatus = subData.status;
    const isActive = subStatus === 1;

    if (!isActive) {
      console.log("[flow] subscription webhook (token): not active", { subId, status: subStatus });
      return res.status(200).send("OK");
    }

    const user = await prisma.user.findFirst({
      where: { flowSubscriptionId: subId },
      select: { id: true, membershipExpiresAt: true }
    });

    if (!user) {
      // Not a Uzeed Pro user — try to resolve as a U-Mate direct subscription
      const handledByUmate = await extendUmateDirectSubFromWebhook(subId, "flow_subscription_token");
      if (handledByUmate) return res.status(200).send("OK");

      console.error("[flow] subscription webhook (token): subscription not found in User nor UmateDirectSubscription", { subId });
      return res.status(200).send("OK");
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: user.id }, select: { membershipExpiresAt: true } });
      const base = current?.membershipExpiresAt && current.membershipExpiresAt.getTime() > now.getTime()
        ? current.membershipExpiresAt : now;
      const expiresAt = addDays(base, config.membershipDays);
      await tx.user.update({ where: { id: user.id }, data: { membershipExpiresAt: expiresAt } });
      await tx.notification.create({
        data: { userId: user.id, type: "SUBSCRIPTION_RENEWED", data: { subscriptionId: subId, source: "flow_subscription_token" } }
      });
    });

    console.log("[flow] membership extended via subscription webhook (token)", { userId: user.id, subId });
    return res.status(200).send("OK");
  }

  // ── Pattern A: direct subscriptionId + status + signature ────────────
  const { s, ...params } = body;

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

  if (!subscriptionId) {
    return res.status(400).json({ error: "MISSING_SUBSCRIPTION_ID" });
  }

  const flowStatus = Number(status);
  const isActive = flowStatus === 1;

  const user = await prisma.user.findFirst({
    where: { flowSubscriptionId: subscriptionId },
    select: { id: true, membershipExpiresAt: true, flowSubscriptionId: true }
  });

  if (!user) {
    // Not a Uzeed Pro user — try U-Mate direct subscription
    if (isActive) {
      const handledByUmate = await extendUmateDirectSubFromWebhook(subscriptionId, "flow_subscription");
      if (handledByUmate) {
        return res.json({ ok: true, subscriptionId, status: flowStatus, activated: true, scope: "umate" });
      }
    }
    console.error("[flow] webhook: subscriptionId not found in User nor UmateDirectSubscription", { subscriptionId });
    return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
  }

  if (!isActive) {
    console.log("[flow] webhook: subscription not active", { subscriptionId, status: flowStatus });
    return res.json({ ok: true, subscriptionId, status: flowStatus, activated: false });
  }

  // For PAC (recurring): Flow sends this webhook each billing cycle, so we must
  // ALWAYS extend the membership, even if it's currently active.
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: user.id },
      select: { membershipExpiresAt: true }
    });

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

        // Check if this is a PendingGoldRegistration that failed
        if (candidates.length) {
          const failedPending = await prisma.pendingGoldRegistration.findFirst({
            where: { id: { in: candidates }, status: "PENDING" },
          });
          if (failedPending) {
            await prisma.pendingGoldRegistration.update({
              where: { id: failedPending.id },
              data: { status: "FAILED" },
            });
            console.log("[flow webhook] PendingGoldRegistration marked FAILED", { pendingId: failedPending.id });
          }
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
      // Check if this is a PendingGoldRegistration payment (no PaymentIntent exists yet)
      const pendingReg = candidates.length
        ? await prisma.pendingGoldRegistration.findFirst({
            where: { id: { in: candidates }, status: "PENDING" },
          })
        : null;

      if (pendingReg) {
        try {
          const formData = JSON.parse(pendingReg.formData);
          const fileUrls: string[] = JSON.parse(pendingReg.fileUrls || "[]");

          // Create the professional user now that payment is confirmed
          const { user } = await createProfessionalUser({
            ...formData,
            galleryUrls: fileUrls,
            tier: "GOLD",
          });

          // Create PaymentIntent for audit trail
          await prisma.paymentIntent.create({
            data: {
              subscriberId: user.id,
              purpose: "PUBLICATE_GOLD",
              method: "FLOW",
              status: "PAID",
              amount: payment.amount || 14990,
              providerPaymentId: token,
              paidAt: new Date(),
            },
          });

          await prisma.notification.create({
            data: {
              userId: user.id,
              type: "SUBSCRIPTION_RENEWED",
              data: { source: "publicate_gold", plan: "GOLD", days: 7, flowOrder: payment.flowOrder, commerceOrder },
            },
          });

          // Mark pending as completed
          await prisma.pendingGoldRegistration.update({
            where: { id: pendingReg.id },
            data: { status: "PAID" },
          });

          console.log("[flow webhook] PUBLICATE_GOLD: user created after payment", { userId: user.id, pendingId: pendingReg.id });
        } catch (err) {
          console.error("[flow webhook] PUBLICATE_GOLD: failed to create user", { pendingId: pendingReg.id, error: err });
        }
        return res.status(200).send("OK");
      }

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
