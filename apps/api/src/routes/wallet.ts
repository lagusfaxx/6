import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { env } from "../lib/env";

export const walletRouter = Router();

const storage = new LocalStorageProvider(
  path.join(process.cwd(), env.UPLOADS_DIR),
  "/uploads",
);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
  const cfg = await prisma.platformConfig.findUnique({ where: { key: "token_rate_clp" } });
  return cfg ? parseInt(cfg.value, 10) : 1000;
}

/* ── Helper: platform commission % ── */
async function getCommissionPercent(): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({ where: { key: "platform_commission_percent" } });
  return cfg ? parseInt(cfg.value, 10) : 10;
}

/* ── Helper: no-show penalty tokens ── */
async function getNoShowPenalty(): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({ where: { key: "noshow_penalty_tokens" } });
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
  const total = await prisma.tokenTransaction.count({ where: { walletId: wallet.id } });
  res.json({ transactions, total });
});

// ── POST /wallet/deposit — request token deposit with receipt ──
walletRouter.post("/wallet/deposit", requireAuth, upload.single("receipt"), async (req, res) => {
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

  res.json({ deposit });
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
  const { amount, bankName, accountType, accountNumber, holderName, holderRut } = req.body;
  const tokens = parseInt(String(amount || "0"), 10);
  if (tokens < 1) return res.status(400).json({ error: "Minimum 1 token" });
  if (!bankName || !accountType || !accountNumber || !holderName || !holderRut) {
    return res.status(400).json({ error: "All bank details required" });
  }

  const wallet = await getOrCreateWallet(req.session.userId!);
  if (wallet.balance < tokens) {
    return res.status(400).json({ error: "Insufficient balance" });
  }

  const rate = await getTokenRate();
  const clpAmount = tokens * rate;

  // Deduct from balance atomically
  const updated = await prisma.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: tokens } },
    data: { balance: { decrement: tokens } },
  });
  if (updated.count === 0) return res.status(400).json({ error: "Insufficient balance" });

  const updatedWallet = await prisma.wallet.findUnique({ where: { id: wallet.id } });

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawalRequest.create({
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
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        amount: -tokens,
        balance: updatedWallet!.balance,
        description: `Solicitud de retiro: ${tokens} tokens ($${clpAmount.toLocaleString("es-CL")} CLP)`,
      },
    }),
  ]);

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
export { getOrCreateWallet, getTokenRate, getCommissionPercent, getNoShowPenalty };
