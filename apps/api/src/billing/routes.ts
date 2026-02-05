import { Router } from "express";
import crypto from "crypto";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { createPayment } from "../khipu/client";
import { verifyKhipuSignature } from "../khipu/webhook";
import { addDays } from "@uzeed/shared";
import { asyncHandler } from "../lib/asyncHandler";

export const billingRouter = Router();

function subscriptionBaseDate(expiresAt: Date | null) {
  const now = new Date();
  if (expiresAt && expiresAt.getTime() > now.getTime()) return expiresAt;
  return now;
}

billingRouter.post("/billing/creator-subscriptions/start", requireAuth, asyncHandler(async (req, res) => {
  const subscriberId = req.session.userId!;
  const profileId = String(req.body?.profileId || "");
  if (!profileId) return res.status(400).json({ error: "PROFILE_REQUIRED" });

  const profile = await prisma.user.findUnique({
    where: { id: profileId },
    select: { id: true, profileType: true, subscriptionPrice: true, username: true }
  });
  if (!profile) return res.status(404).json({ error: "PROFILE_NOT_FOUND" });
  if (profile.profileType !== "CREATOR") return res.status(400).json({ error: "NOT_SUBSCRIBABLE" });
  if (profile.id === subscriberId) return res.status(400).json({ error: "SELF_SUBSCRIBE" });

  const amount = Math.max(100, Math.min(20000, profile.subscriptionPrice || 2500));
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId,
      profileId,
      purpose: "CREATOR_SUBSCRIPTION",
      status: "PENDING",
      amount
    }
  });

  const transactionId = intent.id;
  const payment = await createPayment({
    amount,
    currency: "CLP",
    subject: `Suscripción a ${profile.username}`,
    body: `Suscripción mensual UZEED para ${profile.username}`,
    transaction_id: transactionId,
    return_url: config.khipuReturnUrl,
    cancel_url: config.khipuCancelUrl,
    notify_url: `${config.apiUrl}/webhooks/khipu/payment`,
    notify_api_version: "3.0"
  });

  if (!payment.payment_id || !payment.payment_url) {
    return res.status(502).json({ error: "KHIPU_INVALID_RESPONSE" });
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerPaymentId: payment.payment_id, paymentUrl: payment.payment_url }
  });

  console.log("[billing] creator subscription start", { intentId: intent.id, profileId, amount });
  return res.json({ intentId: intent.id, paymentUrl: payment.payment_url });
}));



const handleMembershipStart = asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileType: true, username: true }
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // Cliente/Viewer NO pagan. Todo el resto sí.
  if (user.profileType === "CLIENT" || user.profileType === "VIEWER") {
    return res.status(400).json({ error: "NOT_REQUIRED" });
  }

  const amount = config.membershipPriceClp;
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "MEMBERSHIP_PLAN",
      status: "PENDING",
      amount
    }
  });

  const payment = await createPayment({
    amount,
    currency: "CLP",
    subject: "Plan UZEED",
    body: `Plan mensual UZEED - ${user.username}`,
    transaction_id: intent.id,
    return_url: config.khipuReturnUrl,
    cancel_url: config.khipuCancelUrl,
    notify_url: `${config.apiUrl}/webhooks/khipu/payment`,
    notify_api_version: "3.0"
  });

  if (!payment.payment_id || !payment.payment_url) {
    return res.status(502).json({ error: "KHIPU_INVALID_RESPONSE" });
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerPaymentId: payment.payment_id, paymentUrl: payment.payment_url }
  });

  console.log("[billing] membership start", { intentId: intent.id, amount, profileType: user.profileType });
  return res.json({ intentId: intent.id, paymentUrl: payment.payment_url });
});

const handleShopPlanStart = asyncHandler(async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true, username: true } });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
  if (user.profileType !== "SHOP") return res.status(400).json({ error: "NOT_ALLOWED" });

  const amount = config.shopMonthlyPriceClp;
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "SHOP_PLAN",
      status: "PENDING",
      amount
    }
  });

  const transactionId = intent.id;
  const payment = await createPayment({
    amount,
    currency: "CLP",
    subject: "Plan negocio UZEED",
    body: `Plan mensual negocio - ${user.username}`,
    transaction_id: transactionId,
    return_url: config.khipuReturnUrl,
    cancel_url: config.khipuCancelUrl,
    notify_url: `${config.apiUrl}/webhooks/khipu/payment`,
    notify_api_version: "3.0"
  });

  if (!payment.payment_id || !payment.payment_url) {
    return res.status(502).json({ error: "KHIPU_INVALID_RESPONSE" });
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { providerPaymentId: payment.payment_id, paymentUrl: payment.payment_url }
  });

  console.log("[billing] shop plan start", { intentId: intent.id, amount });
  return res.json({ intentId: intent.id, paymentUrl: payment.payment_url });
});

billingRouter.post("/billing/membership/start", requireAuth, handleMembershipStart);

billingRouter.post("/billing/shop-plan/start", requireAuth, handleShopPlanStart);
billingRouter.post("/billing/shop-plans/start", requireAuth, handleShopPlanStart);

const handleKhipuWebhook = asyncHandler(async (req, res) => {
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const sig = req.header("x-khipu-signature");
  if (sig && rawBody) {
    const ok = verifyKhipuSignature(rawBody, sig);
    if (!ok) return res.status(401).json({ error: "INVALID_SIGNATURE" });
  }

  const payload = req.body as { payment_id?: string; status?: string };
  if (!payload.payment_id || !payload.status) return res.status(400).json({ error: "INVALID_PAYLOAD" });

  const intent = await prisma.paymentIntent.findFirst({ where: { providerPaymentId: payload.payment_id } });
  if (!intent) return res.status(404).json({ error: "INTENT_NOT_FOUND" });
  if (intent.status === "PAID") return res.json({ ok: true, status: "PAID" });

  console.log("[billing] webhook received", { intentId: intent.id, status: payload.status });

  if (payload.status !== "done") {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } });
    return res.json({ ok: true, status: "FAILED" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "PAID", paidAt: new Date() }
    });

    if (intent.purpose === "CREATOR_SUBSCRIPTION" && intent.profileId) {
      const existing = await tx.profileSubscription.findUnique({
        where: { subscriberId_profileId: { subscriberId: intent.subscriberId, profileId: intent.profileId } }
      });
      const base = subscriptionBaseDate(existing?.expiresAt || null);
      const expiresAt = addDays(base, config.membershipDays);
      await tx.profileSubscription.upsert({
        where: { subscriberId_profileId: { subscriberId: intent.subscriberId, profileId: intent.profileId } },
        update: { status: "ACTIVE", expiresAt, price: intent.amount },
        create: {
          subscriberId: intent.subscriberId,
          profileId: intent.profileId,
          status: "ACTIVE",
          expiresAt,
          price: intent.amount
        }
      });
      await tx.notification.createMany({
        data: [
          {
            userId: intent.profileId,
            type: "SUBSCRIPTION_STARTED",
            data: { subscriberId: intent.subscriberId, intentId: intent.id }
          },
          {
            userId: intent.subscriberId,
            type: "SUBSCRIPTION_STARTED",
            data: { profileId: intent.profileId, intentId: intent.id }
          }
        ]
      });
    }

    if (intent.purpose === "SHOP_PLAN" || intent.purpose === "MEMBERSHIP_PLAN") {
      const user = await tx.user.findUnique({ where: { id: intent.subscriberId }, select: { membershipExpiresAt: true } });
      const base = subscriptionBaseDate(user?.membershipExpiresAt || null);
      const expiresAt = addDays(base, 30);
      await tx.user.update({ where: { id: intent.subscriberId }, data: { membershipExpiresAt: expiresAt } });
      await tx.notification.create({
        data: {
          userId: intent.subscriberId,
          type: "SUBSCRIPTION_STARTED",
          data: { intentId: intent.id }
        }
      });
    }
  });

  console.log("[billing] subscription activated", { intentId: intent.id });
  return res.json({ ok: true, status: "PAID" });
});

billingRouter.post("/webhooks/khipu/payment", handleKhipuWebhook);
billingRouter.post("/webhooks/khipu", handleKhipuWebhook);
