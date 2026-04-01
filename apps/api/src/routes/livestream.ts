import { Router } from "express";
import path from "node:path";
import fs from "node:fs/promises";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { broadcast, sendToUser } from "../realtime/sse";
import { getOrCreateWallet, getCommissionPercent } from "./wallet";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { env } from "../lib/env";

const storageProvider = new LocalStorageProvider(
  path.resolve(env.UPLOADS_DIR),
  "/uploads",
);

export const livestreamRouter = Router();

/* ── Rate limiters for financial live endpoints ── */
const tipLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  message: { error: "Demasiadas propinas. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

const privateShowLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: { error: "Demasiadas solicitudes. Intenta en un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

const liveChatLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 10,
  message: { error: "Demasiados mensajes. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ── Constants ── */
const MAX_TIP_AMOUNT = 10_000;
const MAX_PRIVATE_SHOW_PRICE = 50_000;

/* ── Safe select: excludes thumbnailUrl to prevent P2022 if migration hasn't run ── */
const STREAM_SELECT = {
  id: true,
  hostId: true,
  title: true,
  isActive: true,
  viewerCount: true,
  maxViewers: true,
  startedAt: true,
  endedAt: true,
  privateShowPrice: true,
  totalTipsEarned: true,
} as const;

// ── POST /live/start — professional starts a live stream ──
livestreamRouter.post("/live/start", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") {
    return res.status(403).json({ error: "Only professionals can go live" });
  }

  try {
    const existing = await prisma.liveStream.findFirst({
      where: { hostId: userId, isActive: true },
    });
    if (existing) return res.status(400).json({ error: "Already streaming", streamId: existing.id });
  } catch {
    // Column may not exist yet if migration pending — continue
  }

  const submittedPrivatePrice = parseInt(String(req.body.privateShowPrice || "0"), 10);
  const savedPrivatePrice = await prisma.platformConfig.findUnique({
    where: { key: `live:host:${userId}:privateShowPrice` },
    select: { value: true },
  });
  const configuredPrivatePrice = submittedPrivatePrice > 0
    ? submittedPrivatePrice
    : parseInt(savedPrivatePrice?.value || "0", 10);

  if (!Number.isFinite(configuredPrivatePrice) || configuredPrivatePrice < 1) {
    return res.status(400).json({ error: "Configura el precio del show privado antes de iniciar el live" });
  }
  if (configuredPrivatePrice > MAX_PRIVATE_SHOW_PRICE) {
    return res.status(400).json({ error: `Precio máximo del show privado: ${MAX_PRIVATE_SHOW_PRICE} tokens` });
  }

  let stream;
  try {
    stream = await prisma.liveStream.create({
      data: {
        hostId: userId,
        title: req.body.title || null,
        privateShowPrice: configuredPrivatePrice,
      },
      select: {
        id: true,
        hostId: true,
        title: true,
        isActive: true,
        viewerCount: true,
        maxViewers: true,
        startedAt: true,
      },
    });
  } catch (err: any) {
    // If thumbnailUrl column missing (P2022), retry with raw SQL fallback
    if (err?.code === "P2022") {
      const created = await prisma.$queryRawUnsafe<any[]>(
        `INSERT INTO "LiveStream" ("id", "hostId", "title", "privateShowPrice", "isActive", "viewerCount", "maxViewers", "startedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, true, 0, 200, NOW())
         RETURNING "id", "hostId", "title", "isActive", "viewerCount", "maxViewers", "startedAt"`,
        userId,
        req.body.title || null,
        configuredPrivatePrice,
      );
      stream = created[0];
    } else {
      throw err;
    }
  }

  broadcast("live:started", {
    streamId: stream.id,
    hostId: userId,
    title: stream.title,
  });

  res.json({ stream });
});

// ── POST /live/:id/end — end the live stream ──
livestreamRouter.post("/live/:id/end", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
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
    select: { id: true },
  });

  broadcast("live:ended", { streamId: stream.id, hostId: stream.hostId });

  res.json({ ok: true });
});

// ── GET /live/active — list active streams ──
livestreamRouter.get("/live/active", async (_req, res) => {
  try {
    const streams = await prisma.liveStream.findMany({
      where: { isActive: true },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        hostId: true,
        title: true,
        isActive: true,
        viewerCount: true,
        maxViewers: true,
        startedAt: true,
        host: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
            coverUrl: true,
            bio: true,
            profileMedia: {
              where: { type: "IMAGE" },
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    });

    // Try to get thumbnailUrl (may fail if column doesn't exist yet)
    let thumbMap: Record<string, string | null> = {};
    try {
      const rows = await prisma.$queryRawUnsafe<{ id: string; thumbnailUrl: string | null }[]>(
        `SELECT "id", "thumbnailUrl" FROM "LiveStream" WHERE "isActive" = true`,
      );
      for (const r of rows) thumbMap[r.id] = r.thumbnailUrl;
    } catch {
      // Column doesn't exist yet — ignore
    }

    // Flatten: pick best thumbnail (live frame > cover > gallery > avatar)
    const mapped = streams.map((s: any) => {
      const firstMedia = s.host.profileMedia?.[0]?.url || null;
      const profileThumb = s.host.coverUrl || firstMedia || s.host.avatarUrl || null;
      return {
        ...s,
        thumbnailUrl: thumbMap[s.id] || profileThumb,
        host: {
          id: s.host.id,
          displayName: s.host.displayName,
          username: s.host.username,
          avatarUrl: s.host.avatarUrl,
          bio: s.host.bio,
        },
      };
    });

    res.json({ streams: mapped });
  } catch (err) {
    console.error("Error fetching active streams:", err);
    res.json({ streams: [] });
  }
});

// ── GET /live/:id — get stream details ──
livestreamRouter.get("/live/:id", async (req, res) => {
  try {
    const stream = await prisma.liveStream.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        hostId: true,
        title: true,
        isActive: true,
        viewerCount: true,
        maxViewers: true,
        startedAt: true,
        endedAt: true,
        privateShowPrice: true,
        totalTipsEarned: true,
        host: {
          select: { id: true, displayName: true, username: true, avatarUrl: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        tipOptions: {
          where: { isActive: true, streamId: null },
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
  } catch (err) {
    console.error("Error fetching stream:", err);
    res.status(500).json({ error: "Error loading stream" });
  }
});

// ── POST /live/:id/thumbnail — host uploads a frame capture as stream thumbnail ──
livestreamRouter.post("/live/:id/thumbnail", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId!;
    const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
    if (!stream) return res.status(404).json({ error: "Not found" });
    if (stream.hostId !== userId) return res.status(403).json({ error: "Not your stream" });
    if (!stream.isActive) return res.status(400).json({ error: "Stream ended" });

    const { dataUrl } = req.body;
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Invalid image data" });
    }

    // Parse base64 data URL
    const matches = dataUrl.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: "Invalid data URL format" });

    const ext = matches[1] === "jpeg" ? ".jpg" : `.${matches[1]}`;
    const buffer = Buffer.from(matches[2], "base64");

    // Limit size (500KB max for thumbnails)
    if (buffer.length > 500 * 1024) {
      return res.status(400).json({ error: "Thumbnail too large" });
    }

    // Delete previous thumbnail file if it exists
    try {
      const prev = await prisma.$queryRawUnsafe<{ thumbnailUrl: string | null }[]>(
        `SELECT "thumbnailUrl" FROM "LiveStream" WHERE "id" = $1::uuid`,
        stream.id,
      );
      const prevUrl = prev[0]?.thumbnailUrl;
      if (prevUrl) {
        // prevUrl is like "/uploads/live-thumbnails/<uuid>.jpg"
        const relative = prevUrl.replace(/^\/uploads\//, "");
        const absPath = path.join(path.resolve(env.UPLOADS_DIR), relative);
        await fs.unlink(absPath).catch(() => {});
      }
    } catch {
      // Column may not exist yet — ignore
    }

    const result = await storageProvider.save({
      buffer,
      filename: `thumb${ext}`,
      mimeType: `image/${matches[1]}`,
      folder: "live-thumbnails",
    });

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { thumbnailUrl: result.url },
    }).catch((err) => {
      // Column may not exist if migration hasn't run yet
      if (err?.code === "P2022") {
        console.warn("[live] thumbnailUrl column missing — run migration 20260331100000_add_livestream_thumbnail");
      } else {
        throw err;
      }
    });

    res.json({ thumbnailUrl: result.url });
  } catch (err) {
    console.error("Error uploading thumbnail:", err);
    res.status(500).json({ error: "Error uploading thumbnail" });
  }
});

// ── PUT /live/:id/config — professional updates stream config (title, private show price) ──
livestreamRouter.put("/live/:id/config", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== userId) return res.status(403).json({ error: "Not your stream" });
  if (!stream.isActive) return res.status(400).json({ error: "Stream ended" });

  const updates: Record<string, any> = {};
  if (req.body.title !== undefined) updates.title = String(req.body.title || "").trim().slice(0, 100) || null;
  if (req.body.privateShowPrice !== undefined) {
    const price = parseInt(String(req.body.privateShowPrice), 10);
    updates.privateShowPrice = price > 0 ? price : null;
  }
  if (req.body.maxViewers !== undefined) {
    const mv = parseInt(String(req.body.maxViewers), 10);
    if (mv >= 1 && mv <= 1000) updates.maxViewers = mv;
  }

  const updated = await prisma.liveStream.update({
    where: { id: stream.id },
    data: updates,
    select: STREAM_SELECT,
  });

  broadcast("live:config_updated", {
    streamId: stream.id,
    title: updated.title,
    privateShowPrice: updated.privateShowPrice,
    maxViewers: updated.maxViewers,
  });

  res.json({ stream: updated });
});

// ── POST /live/:id/join — viewer joins a live stream ──
livestreamRouter.post("/live/:id/join", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream || !stream.isActive) return res.status(404).json({ error: "Stream not active" });
  if (stream.viewerCount >= stream.maxViewers) {
    return res.status(400).json({ error: "Stream is full (max viewers reached)" });
  }

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { viewerCount: { increment: 1 } },
    select: { id: true },
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
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream) return res.status(404).json({ error: "Not found" });

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { viewerCount: Math.max(0, stream.viewerCount - 1) },
    select: { id: true },
  });

  broadcast("live:viewer_left", {
    streamId: stream.id,
    viewerCount: Math.max(0, stream.viewerCount - 1),
  });

  res.json({ ok: true });
});

// ── POST /live/:id/chat — send message in live chat ──
// BUG FIX: was only sending to host, now broadcasts to all connected users
livestreamRouter.post("/live/:id/chat", requireAuth, liveChatLimiter, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
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
livestreamRouter.post("/live/:id/tip", requireAuth, tipLimiter, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream || !stream.isActive) return res.status(400).json({ error: "Stream not active" });
  if (stream.hostId === userId) return res.status(400).json({ error: "Cannot tip yourself" });

  const amount = parseInt(String(req.body.amount || "0"), 10);
  const message = String(req.body.message || "").trim().slice(0, 200);
  const optionId = req.body.optionId ? String(req.body.optionId) : null;

  if (amount < 1) return res.status(400).json({ error: "Minimum 1 token" });
  if (amount > MAX_TIP_AMOUNT) return res.status(400).json({ error: `Máximo ${MAX_TIP_AMOUNT} tokens por propina` });

  // If tipping a specific option, verify it exists and price matches
  if (optionId) {
    const option = await prisma.liveTipOption.findFirst({
      where: {
        id: optionId,
        hostId: stream.hostId,
        isActive: true,
        OR: [{ streamId: null }, { streamId: stream.id }],
      },
    });
    if (!option) return res.status(400).json({ error: "Option not available" });
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
  let tip;
  try {
    tip = await prisma.$transaction(async (tx) => {
      // Deduct from sender
      const updatedSender = await tx.wallet.updateMany({
        where: { id: senderWallet.id, balance: { gte: amount } },
        data: { balance: { decrement: amount }, totalSpent: { increment: amount } },
      });
      if (updatedSender.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      // Credit to host
      const updatedHost = await tx.wallet.update({
        where: { id: hostWallet.id },
        data: { balance: { increment: hostPay }, totalEarned: { increment: hostPay } },
      });

      // Read actual sender balance after deduction
      const senderAfter = await tx.wallet.findUnique({ where: { id: senderWallet.id } });

      // Record transactions with accurate post-update balances
      await tx.tokenTransaction.create({
        data: {
          walletId: senderWallet.id,
          type: "TIP",
          amount: -amount,
          balance: senderAfter?.balance ?? 0,
          description: `Propina en live: -${amount} tokens`,
        },
      });
      await tx.tokenTransaction.create({
        data: {
          walletId: hostWallet.id,
          type: "TIP",
          amount: hostPay,
          balance: updatedHost.balance,
          description: `Propina recibida: +${hostPay} tokens (${amount} - ${platformFee} comisión)`,
        },
      });

      // Update stream totalTipsEarned
      await tx.liveStream.update({
        where: { id: stream.id },
        data: { totalTipsEarned: { increment: amount } },
        select: { id: true },
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
  } catch (err: any) {
    if (err?.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Saldo insuficiente", required: amount, available: senderWallet.balance });
    }
    throw err;
  }

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


// ── POST /live/tip-options/add — add a global tip option for the host ──
livestreamRouter.post("/live/tip-options/add", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") return res.status(403).json({ error: "Only professionals" });

  const label = String(req.body.label || "").trim().slice(0, 50);
  const price = parseInt(String(req.body.price || "0"), 10);
  const emoji = String(req.body.emoji || "").trim().slice(0, 4) || null;
  if (!label || price < 1) return res.status(400).json({ error: "Label and price required" });
  if (price > MAX_TIP_AMOUNT) return res.status(400).json({ error: `Máximo ${MAX_TIP_AMOUNT} tokens por opción` });

  const count = await prisma.liveTipOption.count({ where: { hostId: userId, streamId: null, isActive: true } });
  if (count >= 20) return res.status(400).json({ error: "Max 20 tip options" });

  const option = await prisma.liveTipOption.create({
    data: { hostId: userId, streamId: null, label, price, emoji, sortOrder: count, isActive: true },
  });

  // Broadcast to viewers if host is currently live
  const activeStream = await prisma.liveStream.findFirst({ where: { hostId: userId, isActive: true }, select: { id: true } });
  if (activeStream) {
    broadcast("live:tip_option_added", {
      streamId: activeStream.id,
      option: { id: option.id, label: option.label, price: option.price, emoji: option.emoji },
    });
  }

  res.json({ option });
});

// ── DELETE /live/tip-options/:optionId — deactivate a global tip option ──
livestreamRouter.delete("/live/tip-options/:optionId", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  await prisma.liveTipOption.updateMany({
    where: { id: req.params.optionId, hostId: userId, streamId: null },
    data: { isActive: false },
  });

  // Broadcast removal to viewers if host is currently live
  const activeStream = await prisma.liveStream.findFirst({ where: { hostId: userId, isActive: true }, select: { id: true } });
  if (activeStream) {
    broadcast("live:tip_option_removed", {
      streamId: activeStream.id,
      optionId: req.params.optionId,
    });
  }

  res.json({ ok: true });
});

// ── GET /live/tip-options/:hostId — get a host's global tip options ──
livestreamRouter.get("/live/tip-options/:hostId", async (req, res) => {
  const options = await prisma.liveTipOption.findMany({
    where: { hostId: req.params.hostId, streamId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  res.json({ options });
});

// ── POST /live/:id/tip-options — returns host global tip options (legacy compatibility) ──
livestreamRouter.post("/live/:id/tip-options", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== userId) return res.status(403).json({ error: "Not your stream" });

  const options = await prisma.liveTipOption.findMany({
    where: { hostId: userId, streamId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  res.json({ options });
});


// ── GET /live/studio/settings — get host live studio config ──
livestreamRouter.get("/live/studio/settings", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") return res.status(403).json({ error: "Only professionals" });

  const [config, tipOptions, activeStream] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { key: `live:host:${userId}:privateShowPrice` }, select: { value: true } }),
    prisma.liveTipOption.findMany({ where: { hostId: userId, streamId: null }, orderBy: { sortOrder: "asc" } }),
    prisma.liveStream.findFirst({ where: { hostId: userId, isActive: true }, select: { id: true, title: true, viewerCount: true, startedAt: true, privateShowPrice: true } }),
  ]);

  const privateShowPrice = parseInt(config?.value || "0", 10) || null;
  const activeTipOptions = tipOptions.filter((o) => o.isActive);

  res.json({
    privateShowPrice,
    tipOptions,
    activeTipOptionsCount: activeTipOptions.length,
    checks: {
      hasPrivateShowPrice: Boolean(privateShowPrice && privateShowPrice > 0),
      hasTipOptions: activeTipOptions.length > 0,
      readyToGoLive: Boolean(privateShowPrice && privateShowPrice > 0),
    },
    activeStream,
  });
});

// ── PUT /live/studio/settings — update host live studio config ──
livestreamRouter.put("/live/studio/settings", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") return res.status(403).json({ error: "Only professionals" });

  const privateShowPrice = parseInt(String(req.body.privateShowPrice || "0"), 10);
  if (privateShowPrice < 1) return res.status(400).json({ error: "Private show price must be at least 1 token" });
  if (privateShowPrice > MAX_PRIVATE_SHOW_PRICE) return res.status(400).json({ error: `Máximo ${MAX_PRIVATE_SHOW_PRICE} tokens` });

  await prisma.platformConfig.upsert({
    where: { key: `live:host:${userId}:privateShowPrice` },
    update: { value: String(privateShowPrice) },
    create: { key: `live:host:${userId}:privateShowPrice`, value: String(privateShowPrice) },
  });

  // If host is live, sync current stream config to keep runtime behavior consistent
  const activeStream = await prisma.liveStream.findFirst({ where: { hostId: userId, isActive: true }, select: STREAM_SELECT });
  if (activeStream) {
    await prisma.liveStream.update({ where: { id: activeStream.id }, data: { privateShowPrice }, select: { id: true } });
    broadcast("live:config_updated", {
      streamId: activeStream.id,
      title: activeStream.title,
      privateShowPrice,
      maxViewers: activeStream.maxViewers,
    });
  }

  res.json({ privateShowPrice });
});

// ══════════════════════════════════════════════════════════
//  PRIVATE SHOWS
// ══════════════════════════════════════════════════════════

// ── POST /live/:id/private-show — pay to start/join active private show ──
livestreamRouter.post("/live/:id/private-show", requireAuth, privateShowLimiter, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream || !stream.isActive) return res.status(400).json({ error: "Stream not active" });
  if (stream.hostId === userId) return res.status(400).json({ error: "Host cannot buy private show" });

  const activeShow = await prisma.privateShow.findFirst({
    where: { streamId: stream.id, isActive: true },
  });

  // If there is an active show, allow this user to join it (single payment per active show per user)
  if (activeShow) {
    const alreadyJoined = await prisma.privateShow.findFirst({
      where: { streamId: stream.id, isActive: true, buyerId: userId },
    });
    if (alreadyJoined) {
      return res.status(400).json({ error: "Ya te uniste al show privado activo" });
    }
  }

  const price = stream.privateShowPrice;
  if (!price || price < 1) {
    return res.status(400).json({ error: "El show privado no está disponible: la profesional no configuró el precio" });
  }

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

  let show;
  try {
    show = await prisma.$transaction(async (tx) => {
      const updated = await tx.wallet.updateMany({
        where: { id: buyerWallet.id, balance: { gte: price } },
        data: { balance: { decrement: price }, totalSpent: { increment: price } },
      });
      if (updated.count === 0) throw new Error("INSUFFICIENT_BALANCE");

      const updatedHostWallet = await tx.wallet.update({
        where: { id: hostWallet.id },
        data: { balance: { increment: hostPay }, totalEarned: { increment: hostPay } },
      });

      // Read actual buyer balance after deduction
      const buyerAfter = await tx.wallet.findUnique({ where: { id: buyerWallet.id } });

      await tx.tokenTransaction.create({
        data: {
          walletId: buyerWallet.id,
          type: "PRIVATE_SHOW",
          amount: -price,
          balance: buyerAfter?.balance ?? 0,
          description: `Show privado: -${price} tokens`,
        },
      });
      await tx.tokenTransaction.create({
        data: {
          walletId: hostWallet.id,
          type: "PRIVATE_SHOW",
          amount: hostPay,
          balance: updatedHostWallet.balance,
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
  } catch (err: any) {
    if (err?.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ error: "Saldo insuficiente", required: price, available: buyerWallet.balance });
    }
    throw err;
  }

  // Broadcast private show purchase to ALL viewers (non-buyers keep blur)
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

// ── POST /live/:id/private-show/end — end the active private show (host only) ──
livestreamRouter.post("/live/:id/private-show/end", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id }, select: STREAM_SELECT });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== userId) return res.status(403).json({ error: "Only host can end private show" });

  const activeShow = await prisma.privateShow.findFirst({
    where: { streamId: stream.id, isActive: true },
  });
  if (!activeShow) return res.status(400).json({ error: "No active private show" });

  await prisma.privateShow.updateMany({
    where: { streamId: stream.id, isActive: true },
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
  const userId = req.session?.userId;
  const show = await prisma.privateShow.findFirst({
    where: { streamId: req.params.id, isActive: true },
    select: { id: true, isActive: true, streamId: true },
  });

  let joined = false;
  if (userId && show) {
    const participation = await prisma.privateShow.findFirst({
      where: { streamId: req.params.id, isActive: true, buyerId: userId },
      select: { id: true },
    });
    joined = Boolean(participation);
  }

  res.json({ active: Boolean(show), joined });
});
