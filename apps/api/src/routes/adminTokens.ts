import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";

export const adminTokensRouter = Router();

// ── GET /admin/deposits — list pending/all deposits ──
adminTokensRouter.get("/admin/deposits", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "PENDING");
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
  const offset = parseInt(String(req.query.offset || "0"), 10);

  const where = status === "ALL" ? {} : { status: status as any };
  const [deposits, total] = await Promise.all([
    prisma.tokenDeposit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        wallet: {
          include: {
            user: { select: { id: true, email: true, displayName: true, username: true, profileType: true } },
          },
        },
      },
    }),
    prisma.tokenDeposit.count({ where }),
  ]);
  res.json({ deposits, total });
});

// ── PUT /admin/deposits/:id/approve — approve a deposit ──
adminTokensRouter.put("/admin/deposits/:id/approve", requireAdmin, async (req, res) => {
  const deposit = await prisma.tokenDeposit.findUnique({
    where: { id: req.params.id },
    include: { wallet: true },
  });
  if (!deposit) return res.status(404).json({ error: "Not found" });
  if (deposit.status !== "PENDING") return res.status(400).json({ error: "Already processed" });

  // Approve and credit tokens atomically
  await prisma.$transaction([
    prisma.tokenDeposit.update({
      where: { id: deposit.id },
      data: { status: "APPROVED", reviewedBy: req.session.userId!, reviewedAt: new Date() },
    }),
    prisma.wallet.update({
      where: { id: deposit.walletId },
      data: { balance: { increment: deposit.amount } },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: deposit.walletId,
        type: "DEPOSIT",
        amount: deposit.amount,
        balance: deposit.wallet.balance + deposit.amount,
        referenceId: deposit.id,
        description: `Depósito aprobado: ${deposit.amount} tokens`,
      },
    }),
  ]);

  res.json({ ok: true });
});

// ── PUT /admin/deposits/:id/reject — reject a deposit ──
adminTokensRouter.put("/admin/deposits/:id/reject", requireAdmin, async (req, res) => {
  const deposit = await prisma.tokenDeposit.findUnique({ where: { id: req.params.id } });
  if (!deposit) return res.status(404).json({ error: "Not found" });
  if (deposit.status !== "PENDING") return res.status(400).json({ error: "Already processed" });

  await prisma.tokenDeposit.update({
    where: { id: deposit.id },
    data: {
      status: "REJECTED",
      reviewedBy: req.session.userId!,
      reviewedAt: new Date(),
      rejectReason: req.body.reason || null,
    },
  });

  res.json({ ok: true });
});

// ── GET /admin/withdrawals — list withdrawal requests ──
adminTokensRouter.get("/admin/withdrawals", requireAdmin, async (req, res) => {
  const status = String(req.query.status || "PENDING");
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
  const offset = parseInt(String(req.query.offset || "0"), 10);

  const where = status === "ALL" ? {} : { status: status as any };
  const [withdrawals, total] = await Promise.all([
    prisma.withdrawalRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        wallet: {
          include: {
            user: { select: { id: true, email: true, displayName: true, username: true, profileType: true } },
          },
        },
      },
    }),
    prisma.withdrawalRequest.count({ where }),
  ]);
  res.json({ withdrawals, total });
});

// ── PUT /admin/withdrawals/:id/approve — approve withdrawal ──
adminTokensRouter.put("/admin/withdrawals/:id/approve", requireAdmin, async (req, res) => {
  const wr = await prisma.withdrawalRequest.findUnique({ where: { id: req.params.id } });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.status !== "PENDING") return res.status(400).json({ error: "Already processed" });

  await prisma.withdrawalRequest.update({
    where: { id: wr.id },
    data: { status: "APPROVED", reviewedBy: req.session.userId!, reviewedAt: new Date() },
  });

  res.json({ ok: true });
});

// ── PUT /admin/withdrawals/:id/reject — reject withdrawal (refund tokens) ──
adminTokensRouter.put("/admin/withdrawals/:id/reject", requireAdmin, async (req, res) => {
  const wr = await prisma.withdrawalRequest.findUnique({
    where: { id: req.params.id },
    include: { wallet: true },
  });
  if (!wr) return res.status(404).json({ error: "Not found" });
  if (wr.status !== "PENDING") return res.status(400).json({ error: "Already processed" });

  // Refund tokens back to wallet
  await prisma.$transaction([
    prisma.withdrawalRequest.update({
      where: { id: wr.id },
      data: {
        status: "REJECTED",
        reviewedBy: req.session.userId!,
        reviewedAt: new Date(),
        rejectReason: req.body.reason || null,
      },
    }),
    prisma.wallet.update({
      where: { id: wr.walletId },
      data: { balance: { increment: wr.amount } },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: wr.walletId,
        type: "ADJUSTMENT",
        amount: wr.amount,
        balance: wr.wallet.balance + wr.amount,
        referenceId: wr.id,
        description: `Retiro rechazado — tokens devueltos: ${wr.amount}`,
      },
    }),
  ]);

  res.json({ ok: true });
});

// ── GET/PUT /admin/platform-config — manage platform settings ──
adminTokensRouter.get("/admin/platform-config", requireAdmin, async (_req, res) => {
  const configs = await prisma.platformConfig.findMany();
  const map: Record<string, string> = {};
  for (const c of configs) map[c.key] = c.value;
  res.json({ config: map });
});

adminTokensRouter.put("/admin/platform-config", requireAdmin, async (req, res) => {
  const entries = req.body.entries as { key: string; value: string }[];
  if (!Array.isArray(entries)) return res.status(400).json({ error: "entries array required" });

  await prisma.$transaction(
    entries.map((e) =>
      prisma.platformConfig.upsert({
        where: { key: e.key },
        update: { value: String(e.value) },
        create: { key: e.key, value: String(e.value) },
      }),
    ),
  );
  res.json({ ok: true });
});
