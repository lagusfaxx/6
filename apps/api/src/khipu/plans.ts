import crypto from "crypto";
import { Router } from "express";
import { requireAuth } from "../auth/middleware";
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
    urlCallback,
    charges_retries_number: charges_retries_number !== undefined ? Number(charges_retries_number) : undefined,
    currency_convert_option: currency_convert_option !== undefined ? Number(currency_convert_option) : undefined
  });

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

  const name = req.body.name || user.displayName || user.username;
  const email = req.body.email || user.email;

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
  const { planId, subscription_start, couponId, trial_period_days } = req.body;

  if (!planId) {
    return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", required: ["planId"] });
  }

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

  // Activate membership inside a transaction (idempotency check inside tx to prevent races)
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({
      where: { id: user.id },
      select: { membershipExpiresAt: true }
    });

    // Idempotency: if membership is already active, skip activation
    if (current?.membershipExpiresAt && current.membershipExpiresAt.getTime() > now.getTime()) {
      return { activated: false, reason: "ALREADY_ACTIVE" as const };
    }

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
        data: { subscriptionId, source: "flow" }
      }
    });

    return { activated: true, reason: undefined };
  });

  if (!result.activated) {
    console.log("[flow] webhook: membership already active, skipping", { subscriptionId });
    return res.json({ ok: true, subscriptionId, status: flowStatus, activated: false, reason: result.reason });
  }

  console.log("[flow] membership activated via webhook", { userId: user.id, subscriptionId });
  return res.json({ ok: true, subscriptionId, status: flowStatus, activated: true });
}));
