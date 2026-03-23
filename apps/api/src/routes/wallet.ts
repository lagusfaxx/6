import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { env } from "../lib/env";
import { config } from "../config";
import { createFlowPayment } from "../khipu/client";
import {
  sendDepositConfirmationEmail,
  sendWithdrawalConfirmationEmail,
} from "../lib/transactionEmail";
import { emitAdminEvent } from "../lib/adminEvents";

export const walletRouter = Router();

function normalizeEmail(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g, "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const storage = new LocalStorageProvider(
  path.join(process.cwd(), env.UPLOADS_DIR),
  "/uploads",
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* ── Helper: get or create wallet ── */
async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.wallet.create({ data: { userId } });
  }
  return wallet;
}

/* ── Helper: get token rate (CLP per token) ── */
async function getTokenRate(): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({
    where: { key: "token_rate_clp" },
  });
  return cfg ? parseInt(cfg.value, 10) : 1000;
}

/* ── Helper: platform commission % ── */
async function getCommissionPercent(): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({
    where: { key: "platform_commission_percent" },
  });
  return cfg ? parseInt(cfg.value, 10) : 10;
}

/* ── Helper: no-show penalty tokens ── */
async function getNoShowPenalty(): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({
    where: { key: "noshow_penalty_tokens" },
  });
  return cfg ? parseInt(cfg.value, 10) : 50;
}

// ── GET /wallet — get my wallet balance ──
walletRouter.get("/wallet", requireAuth, async (req, res) => {
  const wallet = await getOrCreateWallet(req.session.userId!);
  const rate = await getTokenRate();
  res.json({
    balance: wallet.balance,
    heldBalance: wallet.heldBalance,
    totalEarned: wallet.totalEarned,
    totalSpent: wallet.totalSpent,
    tokenRateClp: rate,
  });
});

// ── GET /wallet/transactions — transaction history ──
walletRouter.get("/wallet/transactions", requireAuth, async (req, res) => {
  const wallet = await getOrCreateWallet(req.session.userId!);
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
  const offset = parseInt(String(req.query.offset || "0"), 10);

  const transactions = await prisma.tokenTransaction.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
  const total = await prisma.tokenTransaction.count({
    where: { walletId: wallet.id },
  });
  res.json({ transactions, total });
});

// ── POST /wallet/deposit — request token deposit with receipt ──
walletRouter.post(
  "/wallet/deposit",
  requireAuth,
  upload.single("receipt"),
  async (req, res) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Receipt image required" });

    const tokens = parseInt(String(req.body.tokens || "0"), 10);
    if (tokens < 1) return res.status(400).json({ error: "Minimum 1 token" });

    const rate = await getTokenRate();
    const clpAmount = tokens * rate;

    // Save receipt file
    const saved = await storage.save({
      buffer: file.buffer,
      filename: file.originalname,
      mimeType: file.mimetype,
      folder: "receipts",
    });

    const wallet = await getOrCreateWallet(req.session.userId!);

    const deposit = await prisma.tokenDeposit.create({
      data: {
        walletId: wallet.id,
        amount: tokens,
        clpAmount,
        receiptUrl: saved.url,
      },
    });

    // Send confirmation email (fire & forget)
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId! },
      select: { email: true, username: true },
    });
    if (user?.email) {
      sendDepositConfirmationEmail(user.email, {
        tokens,
        clpAmount,
        date: new Date(),
      }).catch(() => {});
    }

    await emitAdminEvent({
      type: "deposit_submitted",
      user: user?.username || null,
      amount: tokens,
    }).catch(() => {});

    res.json({ deposit });
  },
);

// ── GET /wallet/packages — token packages ──
walletRouter.get("/wallet/packages", async (_req, res) => {
  const rate = await getTokenRate();
  const packages = [
    { tokens: 5, clpAmount: 5 * rate, label: "5 tokens" },
    { tokens: 10, clpAmount: 10 * rate, label: "10 tokens" },
    { tokens: 25, clpAmount: 25 * rate, label: "25 tokens" },
    { tokens: 50, clpAmount: 50 * rate, label: "50 tokens" },
    { tokens: 100, clpAmount: 100 * rate, label: "100 tokens" },
    { tokens: 200, clpAmount: 200 * rate, label: "200 tokens" },
  ];
  res.json({ packages, tokenRateClp: rate });
});

// ── POST /wallet/deposit/flow — pay for tokens via Flow ──
walletRouter.post("/wallet/deposit/flow", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const tokens = parseInt(String(req.body.tokens || "0"), 10);
  if (tokens < 1) return res.status(400).json({ error: "Mínimo 1 token" });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, username: true, displayName: true },
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  const email = normalizeEmail(user.email || "");
  if (!email) {
    return res.status(400).json({
      error: "EMAIL_REQUIRED",
      message: "Se requiere email para procesar el pago",
    });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "EMAIL_INVALID",
      message: "El email no tiene un formato válido",
    });
  }

  if (!config.flowApiKey) {
    return res
      .status(503)
      .json({
        error: "PAYMENT_UNAVAILABLE",
        message: "El pago con Flow no está configurado",
      });
  }

  const rate = await getTokenRate();
  const clpAmount = tokens * rate;

  const wallet = await getOrCreateWallet(userId);

  // Create PaymentIntent for tracking
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "TOKEN_PURCHASE",
      method: "FLOW",
      status: "PENDING",
      amount: clpAmount,
    },
  });

  // Create TokenDeposit linked to PaymentIntent
  await prisma.tokenDeposit.create({
    data: {
      walletId: wallet.id,
      amount: tokens,
      clpAmount,
      method: "FLOW",
      paymentIntentId: intent.id,
      status: "PENDING",
    },
  });

  const appUrl = config.appUrl.replace(/\/$/, "");
  const apiUrl = config.apiUrl.replace(/\/$/, "");

  try {
    const payment = await createFlowPayment({
      commerceOrder: intent.id,
      subject: `Compra de ${tokens} tokens`,
      currency: "CLP",
      amount: clpAmount,
      email,
      urlConfirmation: `${apiUrl}/webhooks/flow/payment`,
      urlReturn: `${appUrl}/wallet?deposit=success&ref=${intent.id}`,
    });

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { paymentUrl: payment.url, providerPaymentId: payment.token },
    });

    const redirectUrl = `${payment.url}?token=${payment.token}`;
    console.log("[wallet] Flow token deposit created", {
      userId,
      intentId: intent.id,
      tokens,
      clpAmount,
    });
    return res.json({
      url: redirectUrl,
      token: payment.token,
      intentId: intent.id,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const emailCharCodes = Array.from(email).map((char) => char.charCodeAt(0));

    console.error("[wallet] Flow token deposit failed", {
      userId,
      intentId: intent.id,
      email: JSON.stringify(email),
      emailCharCodes,
      detail,
    });

    await prisma.$transaction(async (tx) => {
      await tx.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "FAILED", notes: detail },
      });

      await tx.tokenDeposit.updateMany({
        where: {
          paymentIntentId: intent.id,
          status: "PENDING",
        },
        data: {
          status: "REJECTED",
          rejectReason: `FLOW_PAYMENT_CREATE_FAILED: ${detail}`,
          reviewedAt: new Date(),
        },
      });
    });

    return res.status(400).json({
      error: "FLOW_PAYMENT_CREATE_FAILED",
      detail,
    });
  }
});

// ── GET /wallet/deposits — my deposit history ──
walletRouter.get("/wallet/deposits", requireAuth, async (req, res) => {
  const wallet = await getOrCreateWallet(req.session.userId!);
  const deposits = await prisma.tokenDeposit.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json({ deposits });
});

// ── POST /wallet/withdraw — request withdrawal ──
walletRouter.post("/wallet/withdraw", requireAuth, async (req, res) => {
  const {
    amount,
    bankName,
    accountType,
    accountNumber,
    holderName,
    holderRut,
  } = req.body;
  const tokens = parseInt(String(amount || "0"), 10);
  if (tokens < 1) return res.status(400).json({ error: "Minimum 1 token" });
  if (
    !bankName ||
    !accountType ||
    !accountNumber ||
    !holderName ||
    !holderRut
  ) {
    return res.status(400).json({ error: "All bank details required" });
  }

  const wallet = await getOrCreateWallet(req.session.userId!);
  if (wallet.balance < tokens) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const rate = await getTokenRate();
  const clpAmount = tokens * rate;

  // Use interactive transaction to prevent race conditions
  const withdrawal = await prisma
    .$transaction(async (tx) => {
      // Lock the wallet row and verify balance inside the transaction
      const currentWallet = await tx.wallet.findUnique({
        where: { id: wallet.id },
      });
      if (!currentWallet || currentWallet.balance < tokens) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: tokens } },
      });

      const newBalance = currentWallet.balance - tokens;

      const wd = await tx.withdrawalRequest.create({
        data: {
          walletId: wallet.id,
          amount: tokens,
          clpAmount,
          bankName,
          accountType,
          accountNumber,
          holderName,
          holderRut,
        },
      });

      await tx.tokenTransaction.create({
        data: {
          walletId: wallet.id,
          type: "WITHDRAWAL",
          amount: -tokens,
          balance: newBalance,
          description: `Solicitud de retiro: ${tokens} tokens ($${clpAmount.toLocaleString("es-CL")} CLP)`,
        },
      });

      return wd;
    })
    .catch((err) => {
      if (err?.message === "INSUFFICIENT_BALANCE") return null;
      throw err;
    });

  if (!withdrawal) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  // Send confirmation email (fire & forget)
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: { email: true, username: true },
  });
  if (user?.email) {
    sendWithdrawalConfirmationEmail(user.email, {
      tokens,
      clpAmount,
      bankName,
      date: new Date(),
    }).catch(() => {});
  }

  await emitAdminEvent({
    type: "withdrawal_requested",
    user: user?.username || null,
    amount: tokens,
  }).catch(() => {});

  res.json({ withdrawal });
});

// ── GET /wallet/withdrawals — my withdrawal history ──
walletRouter.get("/wallet/withdrawals", requireAuth, async (req, res) => {
  const wallet = await getOrCreateWallet(req.session.userId!);
  const withdrawals = await prisma.withdrawalRequest.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  res.json({ withdrawals });
});

// ── GET /wallet/config — public platform config ──
walletRouter.get("/wallet/config", async (_req, res) => {
  const rate = await getTokenRate();
  const commission = await getCommissionPercent();
  res.json({ tokenRateClp: rate, commissionPercent: commission });
});

// ── Export helpers for other modules ──
export {
  getOrCreateWallet,
  getTokenRate,
  getCommissionPercent,
  getNoShowPenalty,
};
