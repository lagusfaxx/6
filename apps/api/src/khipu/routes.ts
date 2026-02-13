import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth } from "../auth/middleware";
import { createSubscription, createChargeIntent, getSubscription } from "./client";
import { verifyKhipuSignature } from "./webhook";
import { asyncHandler } from "../lib/asyncHandler";

export const khipuRouter = Router();

function addDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

khipuRouter.post("/payments/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId! } });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  const subscription = await createSubscription({
    name: `UZEED ${user.username}`,
    email: user.email,
    max_amount: config.membershipPriceClp,
    currency: "CLP",
    notify_url: config.khipuSubscriptionNotifyUrl,
    return_url: config.khipuReturnUrl,
    cancel_url: config.khipuCancelUrl,
    service_reference: user.id,
    description: "Suscripción mensual UZEED"
  });

  const created = await prisma.khipuSubscription.create({
    data: {
      userId: user.id,
      subscriptionId: subscription.subscription_id,
      status: "PENDING",
      redirectUrl: subscription.redirect_url
    }
  });

  return res.json({ subscriptionId: created.subscriptionId, redirectUrl: created.redirectUrl });
}));

khipuRouter.get("/payments/subscription/:id", requireAuth, asyncHandler(async (req, res) => {
  const subscription = await prisma.khipuSubscription.findUnique({ where: { subscriptionId: req.params.id } });
  if (!subscription || subscription.userId !== req.session.userId) return res.status(404).json({ error: "NOT_FOUND" });
  const remote = await getSubscription(req.params.id);
  return res.json({ subscription, remote });
}));

khipuRouter.get("/payments/subscription", requireAuth, asyncHandler(async (req, res) => {
  const subscription = await prisma.khipuSubscription.findFirst({
    where: { userId: req.session.userId! },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ subscription });
}));

khipuRouter.post("/payments/charge-intent", requireAuth, asyncHandler(async (req, res) => {
  const { subscriptionId } = req.body as { subscriptionId?: string };
  if (!subscriptionId) return res.status(400).json({ error: "MISSING_SUBSCRIPTION_ID" });
  const subscription = await prisma.khipuSubscription.findUnique({ where: { subscriptionId } });
  if (!subscription || subscription.userId !== req.session.userId) return res.status(404).json({ error: "NOT_FOUND" });

  const transactionId = crypto.randomUUID();
  const charge = await createChargeIntent({
    subscription_id: subscription.subscriptionId,
    amount: config.membershipPriceClp,
    subject: "UZEED - Suscripción mensual",
    body: `Suscripción mensual UZEED - ${subscription.subscriptionId}`,
    error_response_url: config.khipuChargeNotifyUrl,
    custom: JSON.stringify({ userId: subscription.userId, subscriptionId: subscription.subscriptionId }),
    transaction_id: transactionId,
    notify_url: config.khipuChargeNotifyUrl,
    notify_api_version: "1.3"
  });

  const payment = await prisma.payment.create({
    data: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      providerPaymentId: charge.payment_id,
      transactionId,
      status: "PENDING",
      amount: config.membershipPriceClp,
      currency: "CLP"
    }
  });

  res.json({ paymentId: payment.id, providerPaymentId: payment.providerPaymentId });
}));

khipuRouter.post("/webhooks/khipu/subscription", asyncHandler(async (req, res) => {
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const sig = req.header("x-khipu-signature");
  if (sig && rawBody) {
    const ok = verifyKhipuSignature(rawBody, sig);
    if (!ok) return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  const { subscription_id, status } = req.body as { subscription_id?: string; status?: string };
  if (!subscription_id || !status) return res.status(400).json({ error: "INVALID_PAYLOAD" });

  const subscription = await prisma.khipuSubscription.findUnique({ where: { subscriptionId: subscription_id } });
  if (!subscription) return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });

  await prisma.khipuSubscription.update({
    where: { id: subscription.id },
    data: { status }
  });

  if (status === "enabled" || status === "ENABLED") {
    const transactionId = crypto.randomUUID();
    const charge = await createChargeIntent({
      subscription_id,
      amount: config.membershipPriceClp,
      subject: "UZEED - Suscripción mensual",
      body: `Suscripción mensual UZEED - ${subscription_id}`,
      error_response_url: config.khipuChargeNotifyUrl,
      custom: JSON.stringify({ userId: subscription.userId, subscriptionId }),
      transaction_id: transactionId,
      notify_url: config.khipuChargeNotifyUrl,
      notify_api_version: "1.3"
    });

    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        providerPaymentId: charge.payment_id,
        transactionId,
        status: "PENDING",
        amount: config.membershipPriceClp,
        currency: "CLP"
      }
    });
  }

  return res.json({ ok: true });
}));

khipuRouter.post("/webhooks/khipu/charge", asyncHandler(async (req, res) => {
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const sig = req.header("x-khipu-signature");
  if (sig && rawBody) {
    const ok = verifyKhipuSignature(rawBody, sig);
    if (!ok) return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  const body = req.body as { payment_id?: string; paymentId?: string; transaction_id?: string };
  const paymentId = body.payment_id || body.paymentId;
  if (!paymentId) return res.status(400).json({ error: "MISSING_PAYMENT_ID" });

  const payment = await prisma.payment.findFirst({ where: { providerPaymentId: paymentId } });
  if (!payment) return res.status(404).json({ error: "PAYMENT_NOT_FOUND" });
  if (payment.status === "PAID") return res.json({ ok: true, status: "PAID" });

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: "PAID", paidAt: new Date() } });
    const user = await tx.user.findUnique({ where: { id: payment.userId }, select: { membershipExpiresAt: true } });
    const base = user?.membershipExpiresAt && user.membershipExpiresAt.getTime() > Date.now() ? user.membershipExpiresAt : new Date();
    const newExp = addDays(base, config.membershipDays);
    await tx.user.update({ where: { id: payment.userId }, data: { membershipExpiresAt: newExp } });
  });

  return res.json({ ok: true, status: "PAID" });
}));
