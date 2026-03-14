import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { broadcast, sendToUser } from "../realtime/sse";
import { getOrCreateWallet, getCommissionPercent } from "./wallet";

export const livestreamRouter = Router();

// ── POST /live/start — professional starts a live stream ──
livestreamRouter.post("/live/start", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") {
    return res.status(403).json({ error: "Only professionals can go live" });
  }

  const existing = await prisma.liveStream.findFirst({
    where: { hostId: userId, isActive: true },
  });
  if (existing) return res.status(400).json({ error: "Already streaming", streamId: existing.id });

  const stream = await prisma.liveStream.create({
    data: {
      hostId: userId,
      title: req.body.title || null,
    },
  });

  broadcast("live:started", {
    streamId: stream.id,
    hostId: userId,
    title: stream.title,
  });

  res.json({ stream });
});

// ── POST /live/:id/end — end the live stream ──
livestreamRouter.post("/live/:id/end", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== req.session.userId!) return res.status(403).json({ error: "Not your stream" });
  if (!stream.isActive) return res.status(400).json({ error: "Already ended" });

  // End any active private shows
  await prisma.privateShow.updateMany({
    where: { streamId: stream.id, isActive: true },
    data: { isActive: false, endedAt: new Date() },
  });

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { isActive: false, endedAt: new Date() },
  });

  broadcast("live:ended", { streamId: stream.id, hostId: stream.hostId });

  res.json({ ok: true });
});

// ── GET /live/active — list active streams ──
livestreamRouter.get("/live/active", async (_req, res) => {
  const streams = await prisma.liveStream.findMany({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
    include: {
      host: {
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      },
    },
  });
  res.json({ streams });
});

// ── GET /live/:id — get stream details ──
livestreamRouter.get("/live/:id", async (req, res) => {
  const stream = await prisma.liveStream.findUnique({
    where: { id: req.params.id },
    include: {
      host: {
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      tipOptions: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
      },
      privateShows: {
        where: { isActive: true },
        select: { id: true, buyerId: true, price: true, isActive: true },
      },
    },
  });
  if (!stream) return res.status(404).json({ error: "Not found" });
  res.json({ stream });
});

// ── POST /live/:id/join — viewer joins a live stream ──
livestreamRouter.post("/live/:id/join", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream || !stream.isActive) return res.status(404).json({ error: "Stream not active" });
  if (stream.viewerCount >= stream.maxViewers) {
    return res.status(400).json({ error: "Stream is full (max viewers reached)" });
  }

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { viewerCount: { increment: 1 } },
  });

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: { displayName: true, username: true },
  });

  // Notify host and broadcast to all viewers
  broadcast("live:viewer_joined", {
    streamId: stream.id,
    viewerName: user?.displayName || user?.username || "Alguien",
    viewerCount: stream.viewerCount + 1,
  });

  res.json({ ok: true, viewerCount: stream.viewerCount + 1 });
});

// ── POST /live/:id/leave — viewer leaves ──
livestreamRouter.post("/live/:id/leave", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ error: "Not found" });

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { viewerCount: Math.max(0, stream.viewerCount - 1) },
  });

  broadcast("live:viewer_left", {
    streamId: stream.id,
    viewerCount: Math.max(0, stream.viewerCount - 1),
  });

  res.json({ ok: true });
});

// ── POST /live/:id/chat — send message in live chat ──
// BUG FIX: was only sending to host, now broadcasts to all connected users
livestreamRouter.post("/live/:id/chat", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream || !stream.isActive) return res.status(400).json({ error: "Stream not active" });

  const message = String(req.body.message || "").trim().slice(0, 300);
  if (!message) return res.status(400).json({ error: "Message required" });

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: { displayName: true, username: true },
  });

  const chatMsg = await prisma.liveChatMessage.create({
    data: {
      streamId: stream.id,
      userId: req.session.userId!,
      message,
    },
  });

  // Broadcast chat to ALL connected users (host + viewers)
  broadcast("live:chat", {
    streamId: stream.id,
    messageId: chatMsg.id,
    userId: req.session.userId!,
    userName: user?.displayName || user?.username || "Anónimo",
    message,
    createdAt: chatMsg.createdAt.toISOString(),
  });

  res.json({ message: chatMsg });
});

// ══════════════════════════════════════════════════════════
//  TIP SYSTEM
// ══════════════════════════════════════════════════════════

// ── POST /live/:id/tip — send a tip during a live stream ──
livestreamRouter.post("/live/:id/tip", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream || !stream.isActive) return res.status(400).json({ error: "Stream not active" });
  if (stream.hostId === userId) return res.status(400).json({ error: "Cannot tip yourself" });

  const amount = parseInt(String(req.body.amount || "0"), 10);
  const message = String(req.body.message || "").trim().slice(0, 200);
  const optionId = req.body.optionId ? String(req.body.optionId) : null;

  if (amount < 1) return res.status(400).json({ error: "Minimum 1 token" });

  // If tipping a specific option, verify it exists and price matches
  if (optionId) {
    const option = await prisma.liveTipOption.findUnique({ where: { id: optionId } });
    if (!option || !option.isActive) return res.status(400).json({ error: "Option not available" });
    if (option.price !== amount) return res.status(400).json({ error: "Amount must match option price" });
  }

  // Check balance
  const senderWallet = await getOrCreateWallet(userId);
  if (senderWallet.balance < amount) {
    return res.status(400).json({ error: "Insufficient tokens", required: amount, available: senderWallet.balance });
  }

  const commissionPct = await getCommissionPercent();
  const platformFee = Math.ceil(amount * commissionPct / 100);
  const hostPay = amount - platformFee;

  const hostWallet = await getOrCreateWallet(stream.hostId);

  const sender = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true, avatarUrl: true },
  });

  // Execute tip transaction
  const tip = await prisma.$transaction(async (tx) => {
    // Deduct from sender
    const updatedSender = await tx.wallet.updateMany({
      where: { id: senderWallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
    });
    if (updatedSender.count === 0) throw new Error("INSUFFICIENT_BALANCE");

    // Credit to host
    await tx.wallet.update({
      where: { id: hostWallet.id },
      data: { balance: { increment: hostPay }, totalEarned: { increment: hostPay } },
    });

    // Record transactions
    await tx.tokenTransaction.create({
      data: {
        walletId: senderWallet.id,
        type: "TIP",
        amount: -amount,
        balance: senderWallet.balance - amount,
        description: `Propina en live: -${amount} tokens`,
      },
    });
    await tx.tokenTransaction.create({
      data: {
        walletId: hostWallet.id,
        type: "TIP",
        amount: hostPay,
        balance: hostWallet.balance + hostPay,
        description: `Propina recibida: +${hostPay} tokens (${amount} - ${platformFee} comisión)`,
      },
    });

    // Record tip
    return tx.liveTip.create({
      data: {
        streamId: stream.id,
        senderId: userId,
        receiverId: stream.hostId,
        amount,
        message: message || null,
        optionId,
      },
    });
  });

  // Find the option label if applicable
  let optionLabel: string | null = null;
  let optionEmoji: string | null = null;
  if (optionId) {
    const opt = await prisma.liveTipOption.findUnique({ where: { id: optionId }, select: { label: true, emoji: true } });
    optionLabel = opt?.label ?? null;
    optionEmoji = opt?.emoji ?? null;
  }

  // Broadcast tip to all viewers + host
  broadcast("live:tip", {
    streamId: stream.id,
    tipId: tip.id,
    senderId: userId,
    senderName: sender?.displayName || sender?.username || "Anónimo",
    senderAvatar: sender?.avatarUrl || null,
    amount,
    message: message || null,
    optionId,
    optionLabel,
    optionEmoji,
    createdAt: tip.createdAt.toISOString(),
  });

  res.json({ tip, newBalance: senderWallet.balance - amount });
});

// ── GET /live/:id/tips — get recent tips for a stream ──
livestreamRouter.get("/live/:id/tips", async (req, res) => {
  const tips = await prisma.liveTip.findMany({
    where: { streamId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ tips });
});

// ══════════════════════════════════════════════════════════
//  TIP OPTIONS (redeemable actions created by the professional)
// ══════════════════════════════════════════════════════════

// ── PUT /live/tip-options — professional creates/updates their tip options ──
livestreamRouter.put("/live/tip-options", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") {
    return res.status(403).json({ error: "Only professionals" });
  }

  const options = req.body.options;
  if (!Array.isArray(options)) return res.status(400).json({ error: "options array required" });

  // Deactivate old options
  await prisma.liveTipOption.updateMany({
    where: { hostId: userId, streamId: null },
    data: { isActive: false },
  });

  // Create new options
  const created = [];
  for (let i = 0; i < Math.min(options.length, 20); i++) {
    const opt = options[i];
    const label = String(opt.label || "").trim().slice(0, 50);
    const price = parseInt(String(opt.price || "0"), 10);
    const emoji = String(opt.emoji || "").trim().slice(0, 4) || null;
    if (!label || price < 1) continue;

    const option = await prisma.liveTipOption.create({
      data: {
        hostId: userId,
        streamId: null,
        label,
        price,
        emoji,
        sortOrder: i,
        isActive: true,
      },
    });
    created.push(option);
  }

  res.json({ options: created });
});

// ── GET /live/tip-options/:hostId — get a host's global tip options ──
livestreamRouter.get("/live/tip-options/:hostId", async (req, res) => {
  const options = await prisma.liveTipOption.findMany({
    where: { hostId: req.params.hostId, streamId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ options });
});

// ── POST /live/:id/tip-options — professional adds tip options to a specific stream ──
livestreamRouter.post("/live/:id/tip-options", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== userId) return res.status(403).json({ error: "Not your stream" });

  // Copy global options to this stream if none exist yet
  const existing = await prisma.liveTipOption.count({ where: { streamId: stream.id, isActive: true } });
  if (existing === 0) {
    const globals = await prisma.liveTipOption.findMany({
      where: { hostId: userId, streamId: null, isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    for (const g of globals) {
      await prisma.liveTipOption.create({
        data: {
          hostId: userId,
          streamId: stream.id,
          label: g.label,
          price: g.price,
          emoji: g.emoji,
          sortOrder: g.sortOrder,
          isActive: true,
        },
      });
    }
  }

  const options = await prisma.liveTipOption.findMany({
    where: { streamId: stream.id, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  res.json({ options });
});

// ══════════════════════════════════════════════════════════
//  PRIVATE SHOWS
// ══════════════════════════════════════════════════════════

// ── POST /live/:id/private-show — start a private show (buyer pays tokens) ──
livestreamRouter.post("/live/:id/private-show", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream || !stream.isActive) return res.status(400).json({ error: "Stream not active" });
  if (stream.hostId === userId) return res.status(400).json({ error: "Host cannot buy private show" });

  // Check no active private show already
  const activeShow = await prisma.privateShow.findFirst({
    where: { streamId: stream.id, isActive: true },
  });
  if (activeShow) return res.status(400).json({ error: "A private show is already active" });

  const price = parseInt(String(req.body.price || "0"), 10);
  if (price < 1) return res.status(400).json({ error: "Price required" });

  const buyerWallet = await getOrCreateWallet(userId);
  if (buyerWallet.balance < price) {
    return res.status(400).json({ error: "Insufficient tokens", required: price, available: buyerWallet.balance });
  }

  const commissionPct = await getCommissionPercent();
  const platformFee = Math.ceil(price * commissionPct / 100);
  const hostPay = price - platformFee;
  const hostWallet = await getOrCreateWallet(stream.hostId);

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, username: true },
  });

  const show = await prisma.$transaction(async (tx) => {
    const updated = await tx.wallet.updateMany({
      where: { id: buyerWallet.id, balance: { gte: price } },
      data: { balance: { decrement: price }, totalSpent: { increment: price } },
    });
    if (updated.count === 0) throw new Error("INSUFFICIENT_BALANCE");

    await tx.wallet.update({
      where: { id: hostWallet.id },
      data: { balance: { increment: hostPay }, totalEarned: { increment: hostPay } },
    });

    await tx.tokenTransaction.create({
      data: {
        walletId: buyerWallet.id,
        type: "PRIVATE_SHOW",
        amount: -price,
        balance: buyerWallet.balance - price,
        description: `Show privado: -${price} tokens`,
      },
    });
    await tx.tokenTransaction.create({
      data: {
        walletId: hostWallet.id,
        type: "PRIVATE_SHOW",
        amount: hostPay,
        balance: hostWallet.balance + hostPay,
        description: `Show privado: +${hostPay} tokens (${price} - ${platformFee} comisión)`,
      },
    });

    return tx.privateShow.create({
      data: {
        streamId: stream.id,
        hostId: stream.hostId,
        buyerId: userId,
        price,
      },
    });
  });

  // Broadcast private show started to ALL viewers (so non-buyers get blur)
  broadcast("live:private_show_started", {
    streamId: stream.id,
    showId: show.id,
    buyerId: userId,
    buyerName: buyer?.displayName || buyer?.username || "Alguien",
    price,
  });

  // Notify host
  sendToUser(stream.hostId, "live:private_show_started", {
    streamId: stream.id,
    showId: show.id,
    buyerId: userId,
    buyerName: buyer?.displayName || buyer?.username || "Alguien",
    price,
  });

  res.json({ show, newBalance: buyerWallet.balance - price });
});

// ── POST /live/:id/private-show/end — end the private show (host only) ──
livestreamRouter.post("/live/:id/private-show/end", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== userId) return res.status(403).json({ error: "Only host can end private show" });

  const activeShow = await prisma.privateShow.findFirst({
    where: { streamId: stream.id, isActive: true },
  });
  if (!activeShow) return res.status(400).json({ error: "No active private show" });

  await prisma.privateShow.update({
    where: { id: activeShow.id },
    data: { isActive: false, endedAt: new Date() },
  });

  broadcast("live:private_show_ended", {
    streamId: stream.id,
    showId: activeShow.id,
  });

  res.json({ ok: true });
});

// ── GET /live/:id/private-show — get current private show status ──
livestreamRouter.get("/live/:id/private-show", async (req, res) => {
  const show = await prisma.privateShow.findFirst({
    where: { streamId: req.params.id, isActive: true },
  });
  res.json({ show: show || null });
});
