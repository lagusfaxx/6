import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";
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

/** POST /customer/create */
plansRouter.post("/customer/create", requireAuth, asyncHandler(async (req, res) => {
  const { name, email, externalId } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", required: ["name", "email"] });
  }

  const customer = await createFlowCustomer({ name, email, externalId });
  return res.json(customer);
}));

// ── Flow Subscription ───────────────────────────────────────────────

/** POST /subscription/create */
plansRouter.post("/subscription/create", requireAuth, asyncHandler(async (req, res) => {
  const { planId, customerId, subscription_start, couponId, trial_period_days } = req.body;
  if (!planId || !customerId) {
    return res.status(400).json({ error: "MISSING_REQUIRED_FIELDS", required: ["planId", "customerId"] });
  }

  const subscription = await createFlowSubscription({
    planId,
    customerId,
    subscription_start,
    couponId,
    trial_period_days: trial_period_days !== undefined ? Number(trial_period_days) : undefined
  });
  return res.json(subscription);
}));

/** GET /subscription/get */
plansRouter.get("/subscription/get", requireAuth, asyncHandler(async (req, res) => {
  const subscriptionId = req.query.subscriptionId as string | undefined;
  if (!subscriptionId) return res.status(400).json({ error: "MISSING_SUBSCRIPTION_ID" });

  const subscription = await getFlowSubscription(subscriptionId);
  return res.json(subscription);
}));

/** POST /webhooks/flow/subscription – Flow subscription confirmation callback */
plansRouter.post("/webhooks/flow/subscription", asyncHandler(async (req, res) => {
  const body = req.body as Record<string, string>;
  const { s, ...params } = body;

  if (config.flowSecretKey && s) {
    const expected = signFlowParams(params);
    if (s !== expected) {
      return res.status(401).json({ error: "INVALID_SIGNATURE" });
    }
  }

  const { subscriptionId, status, planId, customerId } = params;
  console.log("[flow] subscription webhook received", { subscriptionId, status, planId, customerId });

  if (!subscriptionId) {
    return res.status(400).json({ error: "MISSING_SUBSCRIPTION_ID" });
  }

  // Acknowledge receipt — business logic to be implemented
  return res.json({ ok: true, subscriptionId, status });
}));
