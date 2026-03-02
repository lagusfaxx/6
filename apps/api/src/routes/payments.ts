import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { env } from "../lib/env";
import { khipuCreatePayment, khipuGetPayment } from "../lib/khipu";
import crypto from "node:crypto";
import { addDays } from "@uzeed/shared";

export const paymentsRouter = Router();

paymentsRouter.post("/payments/create", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const amount = env.MEMBERSHIP_PRICE_CLP;
  const transaction_id = crypto.randomUUID();

  const created = await khipuCreatePayment({
    amount,
    currency: "CLP",
    subject: "Suscripción mensual UZEED",
    body: "Suscripción mensual - acceso al contenido",
    transaction_id,
    return_url: env.KHIPU_RETURN_URL,
    cancel_url: env.KHIPU_CANCEL_URL,
    notify_url: env.KHIPU_NOTIFY_URL,
    notify_api_version: "3.0",
    custom: JSON.stringify({ userId })
  });

  if (!created.payment_id || !created.payment_url) {
    throw new Error("KHIPU_CREATE_INVALID_RESPONSE");
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      providerPaymentId: created.payment_id,
      transactionId: transaction_id,
      amount: amount,
      currency: "CLP",
      status: "PENDING"
    }
  });

  res.json({ paymentId: payment.id, providerPaymentId: created.payment_id, paymentUrl: created.payment_url });
});

paymentsRouter.get("/payments/:paymentId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId } });
  if (!payment || payment.userId !== userId) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ payment });
});

paymentsRouter.post("/payments/:paymentId/refresh", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const payment = await prisma.payment.findUnique({ where: { id: req.params.paymentId } });
  if (!payment || payment.userId !== userId) return res.status(404).json({ error: "NOT_FOUND" });

  if (payment.status === "PAID") return res.json({ payment });

  const remote = await khipuGetPayment(payment.providerPaymentId);
  const status = remote.status;
  if (status === "done") {
    const updated = await markPaymentPaid(payment.id);
    return res.json({ payment: updated });
  }

  return res.json({ payment });
});

export async function markPaymentPaid(paymentId: string) {
  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing) throw new Error("PAYMENT_NOT_FOUND");
  if (existing.status === "PAID") return existing;

  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date() }
  });

  const user = await prisma.user.findUnique({ where: { id: payment.userId }, select: { membershipExpiresAt: true } });
  const now = new Date();
  const base = user?.membershipExpiresAt && user.membershipExpiresAt > now ? user.membershipExpiresAt : now;
  const newExp = addDays(base, env.MEMBERSHIP_DAYS);
  await prisma.user.update({ where: { id: payment.userId }, data: { membershipExpiresAt: newExp } });

  return payment;
}
