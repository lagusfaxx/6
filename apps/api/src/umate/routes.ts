import { Router } from "express";
import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { optimizeImage } from "../lib/imageOptimizer";
import { validateUploadedFile } from "../lib/uploads";
import { sendToUser } from "../realtime/sse";
import { asyncHandler } from "../lib/asyncHandler";

const execFileAsync = promisify(execFile);

export const umateRouter = Router();

const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_MEDIA_MIMES = [...ALLOWED_IMAGE_MIMES, "video/mp4", "video/quicktime", "video/webm"];

const storage = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${(config.apiUrl || "").replace(/\/$/, "")}/uploads`,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

/** Extract first frame from a video buffer and save as JPEG thumbnail */
async function extractVideoThumbnail(videoBuffer: Buffer, originalFilename: string): Promise<string | null> {
  try {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "umate-thumb-"));
    const tmpVideo = path.join(tmpDir, "input" + path.extname(originalFilename));
    const tmpThumb = path.join(tmpDir, "thumb.jpg");
    await fs.writeFile(tmpVideo, videoBuffer);
    await execFileAsync("ffmpeg", [
      "-i", tmpVideo,
      "-vframes", "1",
      "-ss", "0.5",
      "-vf", "scale=640:-2",
      "-q:v", "8",
      tmpThumb,
    ], { timeout: 15000 });
    const thumbBuffer = await fs.readFile(tmpThumb);
    const saved = await storage.save({
      buffer: thumbBuffer,
      filename: "thumb.jpg",
      mimeType: "image/jpeg",
      folder: "umate-thumbs",
    });
    // Cleanup temp files
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return saved.url;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// RATE LIMITERS
// ══════════════════════════════════════════════════════════════════════

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { error: "RATE_LIMIT", message: "Demasiadas solicitudes de pago. Intenta en un minuto." },
});

const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { error: "RATE_LIMIT", message: "Demasiadas acciones. Intenta en un minuto." },
});

const commentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => (req as any).user?.id || req.ip,
  message: { error: "RATE_LIMIT", message: "Demasiados comentarios. Espera un momento." },
});

// ══════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════

async function getUmateConfig(key: string, fallback: number): Promise<number> {
  const cfg = await prisma.platformConfig.findUnique({ where: { key } });
  return cfg ? parseInt(cfg.value, 10) : fallback;
}

/** Check if user has an active U-Mate subscription with available slots */
async function getActiveSubscription(userId: string) {
  return prisma.umateSubscription.findFirst({
    where: { userId, status: "ACTIVE", cycleEnd: { gt: new Date() } },
    include: { plan: true },
    orderBy: { cycleEnd: "desc" },
  });
}

/** Move matured pendingBalance to availableBalance for all eligible creators.
 *  Called opportunistically on creator stats/wallet reads. */
async function maturePendingBalances() {
  // Move pending balances that are older than 1 day to available
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const creators = await prisma.umateCreator.findMany({
    where: { pendingBalance: { gt: 0 }, status: "ACTIVE" },
    select: { id: true, pendingBalance: true },
  });

  for (const creator of creators) {
    // Check if creator has slot activations older than 7 days with pending payouts
    const maturedEntries = await prisma.umateLedgerEntry.findMany({
      where: {
        creatorId: creator.id,
        type: "SLOT_ACTIVATION",
        createdAt: { lte: oneDayAgo },
        maturedAt: null,
      },
    });

    if (maturedEntries.length === 0) continue;

    const maturedAmount = maturedEntries.reduce((sum, e) => sum + e.creatorPayout, 0);
    if (maturedAmount <= 0) continue;

    const amountToMove = Math.min(maturedAmount, creator.pendingBalance);
    if (amountToMove <= 0) continue;

    await prisma.$transaction(async (tx) => {
      await tx.umateCreator.update({
        where: { id: creator.id },
        data: {
          pendingBalance: { decrement: amountToMove },
          availableBalance: { increment: amountToMove },
        },
      });
      // Mark entries as matured
      await tx.umateLedgerEntry.updateMany({
        where: { id: { in: maturedEntries.map((e) => e.id) } },
        data: { maturedAt: new Date() },
      });
    });
  }
}

/** Check if user is subscribed to a specific creator */
async function isSubscribedToCreator(userId: string, creatorId: string): Promise<boolean> {
  const sub = await prisma.umateCreatorSub.findFirst({
    where: { subscriberId: userId, creatorId, expiresAt: { gt: new Date() } },
  });
  return Boolean(sub);
}

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Plans
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/plans", asyncHandler(async (_req, res) => {
  const plans = await prisma.umatePlan.findMany({
    where: { isActive: true },
    orderBy: { priceCLP: "asc" },
  });
  res.json({ plans });
}));

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Feed / Explore
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/feed", asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const filter = req.query.filter as string | undefined; // "free", "premium", or undefined

  const where: any = {
    creator: { status: "ACTIVE" },
  };
  if (filter === "free") {
    // Only posts where ALL media are free
    where.visibility = "FREE";
    where.media = { every: { visibility: "FREE" } };
  }
  if (filter === "premium") {
    // Only posts that have at least one premium media
    where.media = { some: { visibility: "PREMIUM" } };
  }

  const posts = await prisma.umatePost.findMany({
    where,
    include: {
      creator: { select: { id: true, userId: true, displayName: true, avatarUrl: true, subscriberCount: true, user: { select: { username: true } } } },
      media: { orderBy: { pos: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });

  // Increment view counts (fire & forget)
  if (posts.length > 0) {
    prisma.umatePost.updateMany({
      where: { id: { in: posts.map((p) => p.id) } },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
  }

  // Determine which creators the user is subscribed to
  let subscribedCreatorIds = new Set<string>();
  let likedPostIds = new Set<string>();
  if (userId) {
    const subs = await prisma.umateCreatorSub.findMany({
      where: { subscriberId: userId, expiresAt: { gt: new Date() } },
      select: { creatorId: true },
    });
    subscribedCreatorIds = new Set(subs.map((s) => s.creatorId));

    const likes = await prisma.umateLike.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const items = posts.map((post) => {
    const isSubscribed = subscribedCreatorIds.has(post.creatorId);
    return {
      id: post.id,
      caption: post.caption,
      visibility: post.visibility,
      likeCount: post.likeCount,
      viewCount: post.viewCount,
      commentCount: (post as any).commentCount || 0,
      createdAt: post.createdAt,
      creator: post.creator,
      media: post.media.map((m: any) => ({
        ...m,
        isBlurred: m.visibility === "PREMIUM" && !isSubscribed,
      })),
      isBlurred: post.visibility === "PREMIUM" && !isSubscribed,
      isLiked: likedPostIds.has(post.id),
    };
  });

  res.json({ items });
}));

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Explore creators
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creators", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const q = (req.query.q as string || "").trim();

  const where: any = { status: "ACTIVE" };
  if (q) {
    where.displayName = { contains: q, mode: "insensitive" };
  }

  const creators = await prisma.umateCreator.findMany({
    where,
    select: {
      id: true,
      userId: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      subscriberCount: true,
      totalPosts: true,
      totalLikes: true,
      user: { select: { username: true, isVerified: true } },
    },
    orderBy: [{ subscriberCount: "desc" }, { totalLikes: "desc" }, { createdAt: "desc" }],
    take: limit,
    skip: offset,
  });

  res.json({ creators });
}));

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Creator profile
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/profile/:username", asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;

  const user = await prisma.user.findUnique({
    where: { username: req.params.username },
    select: { id: true },
  });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  const creator = await prisma.umateCreator.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      userId: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      coverUrl: true,
      subscriberCount: true,
      totalPosts: true,
      totalLikes: true,
      status: true,
      user: { select: { username: true, isVerified: true } },
    },
  });

  if (!creator || creator.status !== "ACTIVE") {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  const isSubscribed = userId ? await isSubscribedToCreator(userId, creator.id) : false;

  // Get posts
  const posts = await prisma.umatePost.findMany({
    where: { creatorId: creator.id },
    include: { media: { orderBy: { pos: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Increment view counts (fire & forget)
  if (posts.length > 0) {
    prisma.umatePost.updateMany({
      where: { id: { in: posts.map((p) => p.id) } },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
  }

  let likedPostIds = new Set<string>();
  if (userId) {
    const likes = await prisma.umateLike.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const postsWithAccess = posts.map((post) => {
    return {
      ...post,
      commentCount: (post as any).commentCount || 0,
      media: post.media.map((m: any) => ({
        ...m,
        isBlurred: m.visibility === "PREMIUM" && !isSubscribed,
      })),
      isBlurred: post.visibility === "PREMIUM" && !isSubscribed,
      isLiked: likedPostIds.has(post.id),
    };
  });

  res.json({
    creator,
    isSubscribed,
    posts: postsWithAccess,
  });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Like / Unlike
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/posts/:postId/like", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { postId } = req.params;

  const post = await prisma.umatePost.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: "NOT_FOUND" });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.umateLike.create({ data: { postId, userId } });
      await tx.umatePost.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } });
      await tx.umateCreator.update({ where: { id: post.creatorId }, data: { totalLikes: { increment: 1 } } });
    });
    res.json({ liked: true });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // Already liked — unlike (use transaction for atomicity)
      await prisma.$transaction(async (tx) => {
        await tx.umateLike.deleteMany({ where: { postId, userId } });
        // Guard against negative values
        const freshPost = await tx.umatePost.findUnique({ where: { id: postId }, select: { likeCount: true } });
        if (freshPost && freshPost.likeCount > 0) {
          await tx.umatePost.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } });
        }
        const freshCreator = await tx.umateCreator.findUnique({ where: { id: post.creatorId }, select: { totalLikes: true } });
        if (freshCreator && freshCreator.totalLikes > 0) {
          await tx.umateCreator.update({ where: { id: post.creatorId }, data: { totalLikes: { decrement: 1 } } });
        }
      });
      return res.json({ liked: false });
    }
    throw err;
  }
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Subscribe to plan (checkout)
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/subscribe", requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { tier } = req.body as { tier: string };

  if (!["SILVER", "GOLD", "DIAMOND"].includes(tier)) {
    return res.status(400).json({ error: "INVALID_TIER" });
  }

  // Creators cannot subscribe to plans — role restriction
  const isCreator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (isCreator && isCreator.status !== "SUSPENDED") {
    return res.status(403).json({ error: "CREATOR_CANNOT_SUBSCRIBE", message: "Las creadoras no pueden suscribirse a planes. Usa una cuenta diferente." });
  }

  // Check for existing active subscription
  const existing = await getActiveSubscription(userId);
  if (existing) {
    return res.status(400).json({ error: "ALREADY_SUBSCRIBED", message: "Ya tienes un plan U-Mate activo." });
  }

  const plan = await prisma.umatePlan.findUnique({ where: { tier: tier as any } });
  if (!plan || !plan.isActive) return res.status(404).json({ error: "PLAN_NOT_FOUND" });

  // Validate user email for Flow
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  let email = (user?.email || "").trim().toLowerCase().replace(/\+[^@]*@/, "@");
  if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return res.status(400).json({ error: "EMAIL_INVALID" });
  }

  if (!config.flowApiKey) {
    return res.status(503).json({ error: "PAYMENT_UNAVAILABLE" });
  }

  // Create PaymentIntent
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "UMATE_PLAN",
      method: "FLOW",
      status: "PENDING",
      amount: plan.priceCLP,
      notes: JSON.stringify({ tier: plan.tier, planId: plan.id }),
    },
  });

  // Create Flow payment
  const { createFlowPayment } = await import("../khipu/client");
  const apiUrl = config.apiUrl;
  const appUrl = config.appUrl;

  try {
    const payment = await createFlowPayment({
      commerceOrder: intent.id,
      subject: `U-Mate ${plan.name} — Suscripción mensual`,
      currency: "CLP",
      amount: plan.priceCLP,
      email,
      urlConfirmation: `${apiUrl}/webhooks/flow/payment`,
      urlReturn: `${appUrl}/umate/checkout?ref=${intent.id}`,
    });

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { paymentUrl: payment.url, providerPaymentId: payment.token },
    });

    return res.json({ url: `${payment.url}?token=${payment.token}`, intentId: intent.id });
  } catch (err) {
    await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } });
    console.error("[umate] Flow payment error:", err);
    return res.status(502).json({ error: "FLOW_ERROR" });
  }
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Activate plan after payment confirmation
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/subscription/status", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const sub = await getActiveSubscription(userId);

  if (!sub) return res.json({ active: false });

  const creatorSubs = await prisma.umateCreatorSub.findMany({
    where: { subscriptionId: sub.id, expiresAt: { gt: new Date() } },
    include: {
      creator: {
        select: { id: true, displayName: true, avatarUrl: true, user: { select: { username: true } } },
      },
    },
  });

  res.json({
    active: true,
    plan: sub.plan,
    slotsTotal: sub.slotsTotal,
    slotsUsed: sub.slotsUsed,
    slotsAvailable: sub.slotsTotal - sub.slotsUsed,
    cycleStart: sub.cycleStart,
    cycleEnd: sub.cycleEnd,
    subscribedCreators: creatorSubs.map((cs) => ({
      id: cs.creator.id,
      displayName: cs.creator.displayName,
      avatarUrl: cs.creator.avatarUrl,
      username: cs.creator.user?.username,
      activatedAt: cs.activatedAt,
      expiresAt: cs.expiresAt,
    })),
  });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Use a slot to subscribe to a creator
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/creators/:creatorId/subscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { creatorId } = req.params;

  const creator = await prisma.umateCreator.findUnique({ where: { id: creatorId } });
  if (!creator || creator.status !== "ACTIVE") {
    return res.status(404).json({ error: "CREATOR_NOT_FOUND" });
  }

  // Can't subscribe to yourself
  if (creator.userId === userId) {
    return res.status(400).json({ error: "CANNOT_SUBSCRIBE_SELF" });
  }

  // Creators cannot subscribe to other creators — role restriction
  const userIsCreator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (userIsCreator && userIsCreator.status !== "SUSPENDED") {
    return res.status(403).json({ error: "CREATOR_CANNOT_SUBSCRIBE", message: "Las creadoras no pueden suscribirse a perfiles. Usa una cuenta de cliente." });
  }

  // Check active subscription
  const sub = await getActiveSubscription(userId);
  if (!sub) {
    return res.status(403).json({ error: "NO_PLAN", message: "Necesitas un plan U-Mate para suscribirte a creadoras." });
  }

  // Pre-check slots (actual check inside transaction to prevent races)
  if (sub.slotsUsed >= sub.slotsTotal) {
    return res.status(400).json({ error: "NO_SLOTS", message: "No tienes cupos disponibles este ciclo." });
  }

  // Check if already subscribed
  const already = await isSubscribedToCreator(userId, creatorId);
  if (already) {
    return res.status(400).json({ error: "ALREADY_SUBSCRIBED" });
  }

  // Activate slot — calculate economics from plan price
  const platformCommPct = await getUmateConfig("umate_platform_commission_pct", 0);
  const ivaPct = await getUmateConfig("umate_iva_pct", 19);

  // Plan price includes IVA; split per slot
  const grossPerSlot = Math.round(sub.plan.priceCLP / sub.plan.maxSlots);
  const ivaAmount = Math.round(grossPerSlot * ivaPct / (100 + ivaPct));
  const netAfterIva = grossPerSlot - ivaAmount;
  const platformFee = Math.round(netAfterIva * platformCommPct / 100);
  const creatorPayout = netAfterIva - platformFee;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-check slots inside transaction to prevent race conditions
      const freshSub = await tx.umateSubscription.findUnique({ where: { id: sub.id } });
      if (!freshSub || freshSub.slotsUsed >= freshSub.slotsTotal) {
        throw new Error("NO_SLOTS");
      }

      // Create creator subscription
      await tx.umateCreatorSub.create({
        data: {
          subscriptionId: sub.id,
          subscriberId: userId,
          creatorId,
          expiresAt: sub.cycleEnd,
        },
      });

      // Increment slot usage
      await tx.umateSubscription.update({
        where: { id: sub.id },
        data: { slotsUsed: { increment: 1 } },
      });

      // Increment creator subscriber count
      await tx.umateCreator.update({
        where: { id: creatorId },
        data: {
          subscriberCount: { increment: 1 },
          pendingBalance: { increment: creatorPayout },
          totalEarned: { increment: creatorPayout },
        },
      });

      // Ledger: slot activation
      await tx.umateLedgerEntry.create({
        data: {
          creatorId,
          type: "SLOT_ACTIVATION",
          grossAmount: grossPerSlot,
          platformFee,
          ivaAmount,
          creatorPayout,
          netAmount: creatorPayout,
          description: `Suscripción de usuario (${sub.plan.name})`,
          referenceId: sub.id,
          referenceType: "subscription",
        },
      });

      return { slotsUsed: freshSub.slotsUsed + 1, slotsTotal: freshSub.slotsTotal };
    });

    // Notify creator of new subscriber
    prisma.notification.create({
      data: {
        userId: creator.userId,
        type: "UMATE_NEW_SUBSCRIBER",
        data: { subscriberId: userId, creatorId },
      },
    }).then(() => {
      sendToUser(creator.userId, "umate:new_subscriber", { creatorId });
    }).catch(() => {});

    res.json({ subscribed: true, slotsUsed: result.slotsUsed, slotsTotal: result.slotsTotal });
  } catch (err: any) {
    if (err?.message === "NO_SLOTS") {
      return res.status(400).json({ error: "NO_SLOTS", message: "No tienes cupos disponibles este ciclo." });
    }
    throw err;
  }
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator onboarding
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creator/me", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({
    where: { userId },
    include: { user: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true, profileType: true } } },
  });
  res.json({ creator });
}));

umateRouter.post("/umate/creator/onboard", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;

  const existing = await prisma.umateCreator.findUnique({ where: { userId } });
  if (existing) return res.json({ creator: existing });

  // Subscribers (clients with active plan) cannot become creators — role restriction
  const activeSub = await getActiveSubscription(userId);
  if (activeSub) {
    return res.status(403).json({ error: "SUBSCRIBER_CANNOT_CREATE", message: "Los suscriptores no pueden crear cuenta de creadora. Usa una cuenta diferente." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, bio: true, avatarUrl: true },
  });

  const creator = await prisma.umateCreator.create({
    data: {
      userId,
      displayName: user?.displayName || "Creadora",
      bio: user?.bio,
      avatarUrl: user?.avatarUrl,
      status: "DRAFT",
    },
  });

  res.json({ creator });
}));

umateRouter.put("/umate/creator/profile", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const { displayName, bio } = req.body;
  const data: any = {};
  if (displayName !== undefined) data.displayName = displayName;
  if (bio !== undefined) data.bio = bio;

  const updated = await prisma.umateCreator.update({ where: { id: creator.id }, data });

  // Auto-advance status: if profile is complete, move past DRAFT
  if (updated.displayName && updated.bio && updated.avatarUrl && updated.status === "DRAFT") {
    await prisma.umateCreator.update({ where: { id: creator.id }, data: { status: "PENDING_BANK" } });
    updated.status = "PENDING_BANK";
  }

  res.json({ creator: updated });
}));

umateRouter.put("/umate/creator/bank", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const { bankName, accountType, accountNumber, holderName, holderRut } = req.body;
  if (!bankName || !accountType || !accountNumber || !holderName || !holderRut) {
    return res.status(400).json({ error: "ALL_FIELDS_REQUIRED" });
  }

  const updated = await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { bankName, accountType, accountNumber, holderName, holderRut },
  });

  // Auto-advance status: if bank configured, move to pending terms
  if (updated.bankName && (updated.status === "PENDING_BANK" || updated.status === "DRAFT")) {
    await prisma.umateCreator.update({ where: { id: creator.id }, data: { status: "PENDING_TERMS" } });
    updated.status = "PENDING_TERMS";
  }

  res.json({ creator: updated });
}));

umateRouter.post("/umate/creator/accept-terms", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const { terms, rules, contract } = req.body as { terms?: boolean; rules?: boolean; contract?: boolean };
  const data: any = {};
  if (terms) data.termsAcceptedAt = new Date();
  if (rules) data.rulesAcceptedAt = new Date();
  if (contract) data.contractAcceptedAt = new Date();

  const updated = await prisma.umateCreator.update({ where: { id: creator.id }, data });

  // Auto-advance status if all requirements are met
  if (
    updated.displayName &&
    updated.avatarUrl &&
    updated.bio &&
    updated.bankName &&
    updated.termsAcceptedAt &&
    updated.rulesAcceptedAt &&
    updated.contractAcceptedAt
  ) {
    if (updated.status === "DRAFT" || updated.status === "PENDING_TERMS" || updated.status === "PENDING_BANK") {
      await prisma.umateCreator.update({
        where: { id: creator.id },
        data: { status: "PENDING_REVIEW" },
      });
      updated.status = "PENDING_REVIEW";
    }
  }

  res.json({ creator: updated });
}));

umateRouter.post("/umate/creator/avatar", requireAuth, upload.single("file"), asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "NO_FILE" });
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    return res.status(400).json({ error: "INVALID_FILE_TYPE", message: "Solo se permiten imagenes (JPG, PNG, WebP, GIF)." });
  }

  const saved = await storage.save({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    folder: "umate-avatars",
  });

  await prisma.umateCreator.update({ where: { id: creator.id }, data: { avatarUrl: saved.url } });
  res.json({ url: saved.url });
}));

umateRouter.post("/umate/creator/cover", requireAuth, upload.single("file"), asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "NO_FILE" });
  if (!ALLOWED_IMAGE_MIMES.includes(file.mimetype)) {
    return res.status(400).json({ error: "INVALID_FILE_TYPE", message: "Solo se permiten imagenes (JPG, PNG, WebP, GIF)." });
  }

  const saved = await storage.save({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    folder: "umate-covers",
  });

  await prisma.umateCreator.update({ where: { id: creator.id }, data: { coverUrl: saved.url } });
  res.json({ url: saved.url });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator content management
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/posts", requireAuth, contentLimiter, upload.array("files", 10), asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator || creator.status !== "ACTIVE") {
    return res.status(403).json({ error: "NOT_ACTIVE_CREATOR" });
  }

  // All onboarding steps must be complete before publishing
  const pending: string[] = [];
  if (!creator.termsAcceptedAt) pending.push("terms");
  if (!creator.rulesAcceptedAt) pending.push("rules");
  if (!creator.contractAcceptedAt) pending.push("contract");
  if (!creator.bankName || !creator.accountNumber || !creator.holderName || !creator.holderRut) pending.push("bank");
  if (pending.length > 0) {
    return res.status(403).json({ error: "ONBOARDING_INCOMPLETE", pending, message: "Completa todos los pasos de tu perfil antes de publicar." });
  }

  const { caption, visibility } = req.body;
  // mediaVisibility is a JSON array like ["FREE","PREMIUM","PREMIUM"] matching file order
  let mediaVisibilities: string[] = [];
  try {
    mediaVisibilities = req.body.mediaVisibility ? JSON.parse(req.body.mediaVisibility) : [];
  } catch { /* ignore parse errors */ }

  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ error: "NO_FILES" });

  // Validate all file types
  for (const file of files) {
    if (!ALLOWED_MEDIA_MIMES.includes(file.mimetype)) {
      return res.status(400).json({ error: "INVALID_FILE_TYPE", message: `Tipo no permitido: ${file.mimetype}. Solo imagenes y videos.` });
    }
  }

  const mediaItems: { type: "IMAGE" | "VIDEO"; url: string; thumbnailUrl?: string; pos: number; visibility: "FREE" | "PREMIUM" }[] = [];
  for (let i = 0; i < files.length; i++) {
    const saved = await storage.save({
      buffer: files[i].buffer,
      filename: files[i].originalname,
      mimeType: files[i].mimetype,
      folder: "umate-posts",
    });
    const mediaVis = mediaVisibilities[i] === "PREMIUM" ? "PREMIUM" : "FREE";
    let thumbnailUrl: string | undefined;
    if (saved.type === "video") {
      const thumb = await extractVideoThumbnail(files[i].buffer, files[i].originalname);
      if (thumb) thumbnailUrl = thumb;
    }
    mediaItems.push({
      type: saved.type === "video" ? "VIDEO" : "IMAGE",
      url: saved.url,
      thumbnailUrl,
      pos: i,
      visibility: mediaVis,
    });
  }

  // Post visibility: PREMIUM if any media is premium
  const hasPremium = mediaItems.some((m) => m.visibility === "PREMIUM");
  const postVisibility = visibility === "PREMIUM" || hasPremium ? "PREMIUM" : "FREE";

  const post = await prisma.umatePost.create({
    data: {
      creatorId: creator.id,
      caption: caption || null,
      visibility: postVisibility,
      media: { create: mediaItems },
    },
    include: { media: true },
  });

  await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { totalPosts: { increment: 1 } },
  });

  // Notify subscribers of new post (fire & forget)
  prisma.umateCreatorSub.findMany({
    where: { creatorId: creator.id, expiresAt: { gt: new Date() } },
    select: { subscriberId: true },
  }).then((subs) => {
    for (const sub of subs) {
      prisma.notification.create({
        data: {
          userId: sub.subscriberId,
          type: "UMATE_NEW_POST",
          data: { creatorId: creator.id, postId: post.id, creatorName: creator.displayName },
        },
      }).catch(() => {});
      sendToUser(sub.subscriberId, "umate:new_post", {
        creatorId: creator.id,
        postId: post.id,
        creatorName: creator.displayName,
      });
    }
  }).catch(() => {});

  res.json({ post });
}));

umateRouter.get("/umate/creator/posts", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const posts = await prisma.umatePost.findMany({
    where: { creatorId: creator.id },
    include: { media: { orderBy: { pos: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ posts });
}));

umateRouter.delete("/umate/posts/:postId", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const post = await prisma.umatePost.findUnique({ where: { id: req.params.postId } });
  if (!post || post.creatorId !== creator.id) return res.status(404).json({ error: "NOT_FOUND" });

  await prisma.umatePost.delete({ where: { id: post.id } });
  await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { totalPosts: { decrement: 1 } },
  });

  res.json({ deleted: true });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator dashboard stats
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creator/stats", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  // Mature pending balances before reading stats
  await maturePendingBalances().catch(() => {});

  // Re-read creator after maturation
  const freshCreator = await prisma.umateCreator.findUnique({ where: { userId } }) || creator;

  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [newSubsThisCycle, recentLedger, allEarnings] = await Promise.all([
    prisma.umateCreatorSub.count({
      where: { creatorId: creator.id, activatedAt: { gte: cycleStart } },
    }),
    prisma.umateLedgerEntry.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.umateLedgerEntry.findMany({
      where: { creatorId: creator.id, type: "SLOT_ACTIVATION" },
      select: { grossAmount: true, ivaAmount: true, platformFee: true, creatorPayout: true },
    }),
  ]);

  // Calculate lifetime totals from ALL earnings (not just last 20)
  const totals = allEarnings.reduce(
    (acc, e) => ({
      gross: acc.gross + e.grossAmount,
      iva: acc.iva + e.ivaAmount,
      commission: acc.commission + e.platformFee,
      net: acc.net + e.creatorPayout,
    }),
    { gross: 0, iva: 0, commission: 0, net: 0 },
  );

  res.json({
    subscriberCount: freshCreator.subscriberCount,
    newSubsThisCycle,
    totalPosts: freshCreator.totalPosts,
    totalLikes: freshCreator.totalLikes,
    pendingBalance: freshCreator.pendingBalance,
    availableBalance: freshCreator.availableBalance,
    totalEarned: freshCreator.totalEarned,
    status: freshCreator.status,
    ledger: recentLedger,
    totals,
    bankConfigured: Boolean(freshCreator.bankName),
    termsAccepted: Boolean(freshCreator.termsAcceptedAt),
    rulesAccepted: Boolean(freshCreator.rulesAcceptedAt),
    contractAccepted: Boolean(freshCreator.contractAcceptedAt),
  });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator subscribers list
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creator/subscribers", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const now = new Date();
  const subs = await prisma.umateCreatorSub.findMany({
    where: { creatorId: creator.id, expiresAt: { gt: now } },
    include: {
      subscriber: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      subscription: { include: { plan: { select: { tier: true, name: true } } } },
    },
    orderBy: { activatedAt: "desc" },
  });

  const subscribers = subs.map((s) => ({
    id: s.id,
    activatedAt: s.activatedAt,
    expiresAt: s.expiresAt,
    tier: s.subscription.plan.tier,
    planName: s.subscription.plan.name,
    user: s.subscriber,
  }));

  res.json({ subscribers });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator withdrawals
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/creator/withdraw", requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;

  // Mature pending balances before attempting withdrawal
  await maturePendingBalances().catch(() => {});

  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  if (creator.availableBalance < 1) {
    return res.status(400).json({ error: "NO_BALANCE" });
  }

  if (!creator.bankName || !creator.accountNumber || !creator.holderName || !creator.holderRut) {
    return res.status(400).json({ error: "BANK_NOT_CONFIGURED" });
  }

  const amount = creator.availableBalance;

  await prisma.$transaction(async (tx) => {
    await tx.umateCreator.update({
      where: { id: creator.id },
      data: { availableBalance: { decrement: amount } },
    });

    await tx.umateWithdrawal.create({
      data: {
        creatorId: creator.id,
        amount,
        bankName: creator.bankName!,
        accountType: creator.accountType || "corriente",
        accountNumber: creator.accountNumber!,
        holderName: creator.holderName!,
        holderRut: creator.holderRut!,
      },
    });

    await tx.umateLedgerEntry.create({
      data: {
        creatorId: creator.id,
        type: "WITHDRAWAL",
        grossAmount: -amount,
        creatorPayout: -amount,
        netAmount: -amount,
        description: `Retiro solicitado`,
        referenceType: "withdrawal",
      },
    });
  });

  res.json({ withdrawn: amount });
}));

umateRouter.get("/umate/creator/withdrawals", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const withdrawals = await prisma.umateWithdrawal.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({ withdrawals });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Edit post
// ══════════════════════════════════════════════════════════════════════

umateRouter.put("/umate/posts/:postId", requireAuth, contentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const post = await prisma.umatePost.findUnique({ where: { id: req.params.postId } });
  if (!post || post.creatorId !== creator.id) return res.status(404).json({ error: "NOT_FOUND" });

  const { caption, visibility } = req.body;
  const data: any = {};
  if (caption !== undefined) data.caption = caption || null;
  if (visibility && ["FREE", "PREMIUM"].includes(visibility)) data.visibility = visibility;

  const updated = await prisma.umatePost.update({
    where: { id: post.id },
    data,
    include: { media: { orderBy: { pos: "asc" } } },
  });

  res.json({ post: updated });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Cancel subscription (plan)
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/subscription/cancel", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const sub = await getActiveSubscription(userId);
  if (!sub) return res.status(400).json({ error: "NO_ACTIVE_SUBSCRIPTION" });

  // Mark as cancelled — access remains until cycleEnd
  await prisma.umateSubscription.update({
    where: { id: sub.id },
    data: { status: "CANCELLED" },
  });

  res.json({ cancelled: true, accessUntil: sub.cycleEnd });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Unsubscribe from a specific creator
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/creators/:creatorId/unsubscribe", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { creatorId } = req.params;

  const creatorSub = await prisma.umateCreatorSub.findFirst({
    where: { subscriberId: userId, creatorId, expiresAt: { gt: new Date() } },
    include: { subscription: true },
  });

  if (!creatorSub) return res.status(400).json({ error: "NOT_SUBSCRIBED" });

  await prisma.$transaction(async (tx) => {
    // Delete the creator subscription
    await tx.umateCreatorSub.delete({ where: { id: creatorSub.id } });

    // Free up the slot
    await tx.umateSubscription.update({
      where: { id: creatorSub.subscriptionId },
      data: { slotsUsed: { decrement: 1 } },
    });

    // Decrement creator subscriber count
    const freshCreator = await tx.umateCreator.findUnique({ where: { id: creatorId }, select: { subscriberCount: true } });
    if (freshCreator && freshCreator.subscriberCount > 0) {
      await tx.umateCreator.update({
        where: { id: creatorId },
        data: { subscriberCount: { decrement: 1 } },
      });
    }
  });

  res.json({ unsubscribed: true });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Comments
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/posts/:postId/comments", asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const limit = Math.min(parseInt(String(req.query.limit || "30"), 10) || 30, 100);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;

  const post = await prisma.umatePost.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: "NOT_FOUND" });

  const [comments, total] = await Promise.all([
    prisma.umateComment.findMany({
      where: { postId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.umateComment.count({ where: { postId } }),
  ]);

  res.json({ comments, total });
}));

umateRouter.post("/umate/posts/:postId/comments", requireAuth, commentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { postId } = req.params;
  const { text } = req.body;

  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return res.status(400).json({ error: "TEXT_REQUIRED" });
  }
  if (text.length > 1000) {
    return res.status(400).json({ error: "TEXT_TOO_LONG", message: "Máximo 1000 caracteres." });
  }

  const post = await prisma.umatePost.findUnique({
    where: { id: postId },
    include: { creator: { select: { id: true, userId: true, displayName: true } } },
  });
  if (!post) return res.status(404).json({ error: "NOT_FOUND" });

  // Check access: premium posts require subscription
  if (post.visibility === "PREMIUM") {
    const isCreatorOwner = post.creator.userId === userId;
    if (!isCreatorOwner) {
      const subscribed = await isSubscribedToCreator(userId, post.creatorId);
      if (!subscribed) return res.status(403).json({ error: "PREMIUM_ONLY" });
    }
  }

  const comment = await prisma.umateComment.create({
    data: { postId, userId, text: text.trim() },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
  });

  await prisma.umatePost.update({
    where: { id: postId },
    data: { commentCount: { increment: 1 } },
  });

  // Notify creator of new comment (fire & forget)
  if (post.creator.userId !== userId) {
    prisma.notification.create({
      data: {
        userId: post.creator.userId,
        type: "UMATE_NEW_COMMENT",
        data: { postId, commentId: comment.id, userId, creatorId: post.creatorId },
      },
    }).then(() => {
      sendToUser(post.creator.userId, "umate:new_comment", { postId, commentId: comment.id });
    }).catch(() => {});
  }

  res.json({ comment });
}));

umateRouter.delete("/umate/comments/:commentId", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const comment = await prisma.umateComment.findUnique({
    where: { id: req.params.commentId },
    include: { post: { select: { creatorId: true } } },
  });
  if (!comment) return res.status(404).json({ error: "NOT_FOUND" });

  // Allow comment author or post creator to delete
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  const isCommentAuthor = comment.userId === userId;
  const isPostCreator = creator && comment.post.creatorId === creator.id;

  if (!isCommentAuthor && !isPostCreator) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  await prisma.$transaction(async (tx) => {
    await tx.umateComment.delete({ where: { id: comment.id } });
    const freshPost = await tx.umatePost.findUnique({ where: { id: comment.postId }, select: { commentCount: true } });
    if (freshPost && freshPost.commentCount > 0) {
      await tx.umatePost.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      });
    }
  });

  res.json({ deleted: true });
}));

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Trending / Recommended feed
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/trending", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);

  // Trending = posts from last 7 days with highest engagement (likes + views + comments)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const posts = await prisma.umatePost.findMany({
    where: {
      createdAt: { gte: weekAgo },
      creator: { status: "ACTIVE" },
      visibility: "FREE", // Only show free content in trending
    },
    include: {
      creator: { select: { id: true, userId: true, displayName: true, avatarUrl: true, subscriberCount: true, user: { select: { username: true } } } },
      media: { orderBy: { pos: "asc" } },
    },
    orderBy: [{ likeCount: "desc" }, { viewCount: "desc" }, { commentCount: "desc" }],
    take: limit,
  });

  const items = posts.map((post) => ({
    id: post.id,
    caption: post.caption,
    visibility: post.visibility,
    likeCount: post.likeCount,
    viewCount: post.viewCount,
    commentCount: post.commentCount,
    createdAt: post.createdAt,
    creator: post.creator,
    media: post.media,
    isBlurred: false,
    isLiked: false,
  }));

  res.json({ items });
}));

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Suggested creators (for sidebar)
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/suggested", asyncHandler(async (req, res) => {
  const userId = (req as any).user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || "5"), 10) || 5, 20);

  // Get creators the user is NOT subscribed to
  let excludeCreatorIds: string[] = [];
  if (userId) {
    const subs = await prisma.umateCreatorSub.findMany({
      where: { subscriberId: userId, expiresAt: { gt: new Date() } },
      select: { creatorId: true },
    });
    excludeCreatorIds = subs.map((s) => s.creatorId);
  }

  const creators = await prisma.umateCreator.findMany({
    where: {
      status: "ACTIVE",
      ...(excludeCreatorIds.length > 0 ? { id: { notIn: excludeCreatorIds } } : {}),
    },
    select: {
      id: true,
      displayName: true,
      avatarUrl: true,
      coverUrl: true,
      subscriberCount: true,
      totalPosts: true,
      totalLikes: true,
      bio: true,
      user: { select: { username: true, isVerified: true } },
    },
    orderBy: [{ subscriberCount: "desc" }, { totalLikes: "desc" }],
    take: limit,
  });

  res.json({ creators });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Payment verification (used by checkout page)
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/payment/status", requireAuth, asyncHandler(async (req, res) => {
  const ref = req.query.ref as string;
  if (!ref) return res.status(400).json({ error: "MISSING_REF" });

  let intent = await prisma.paymentIntent.findUnique({ where: { id: ref } });
  if (!intent) return res.status(404).json({ error: "NOT_FOUND" });

  // Only the payer can check their own payment
  if (intent.subscriberId !== (req as any).user.id) {
    return res.status(403).json({ error: "FORBIDDEN" });
  }

  // If still pending and we have a Flow token, check directly with Flow
  if (intent.status === "PENDING" && intent.providerPaymentId) {
    try {
      const { getFlowPaymentStatus } = await import("../khipu/client");
      const flowPayment = await getFlowPaymentStatus(intent.providerPaymentId);
      // Flow status: 1=pending, 2=paid, 3=rejected, 4=canceled
      if (flowPayment.status === 3 || flowPayment.status === 4) {
        await prisma.paymentIntent.update({
          where: { id: intent.id },
          data: { status: "FAILED" },
        });
        intent = { ...intent, status: "FAILED" };
      }
    } catch {
      // If Flow check fails, keep current status
    }
  }

  const statusMap: Record<string, string> = {
    PAID: "paid",
    PENDING: "pending",
    FAILED: "rejected",
    EXPIRED: "expired",
  };

  res.json({
    status: statusMap[intent.status] || "pending",
    intentId: intent.id,
    purpose: intent.purpose,
  });
}));

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator detailed post analytics
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creator/analytics", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalViews,
    recentSubs,
    weekSubs,
    topPosts,
    postsByVisibility,
    recentEarnings,
  ] = await Promise.all([
    prisma.umatePost.aggregate({
      _sum: { viewCount: true, likeCount: true, commentCount: true },
      where: { creatorId: creator.id },
    }),
    prisma.umateCreatorSub.count({
      where: { creatorId: creator.id, activatedAt: { gte: thirtyDaysAgo } },
    }),
    prisma.umateCreatorSub.count({
      where: { creatorId: creator.id, activatedAt: { gte: sevenDaysAgo } },
    }),
    prisma.umatePost.findMany({
      where: { creatorId: creator.id },
      select: { id: true, caption: true, visibility: true, likeCount: true, viewCount: true, commentCount: true, createdAt: true },
      orderBy: { likeCount: "desc" },
      take: 5,
    }),
    prisma.umatePost.groupBy({
      by: ["visibility"],
      _count: { id: true },
      where: { creatorId: creator.id },
    }),
    prisma.umateLedgerEntry.aggregate({
      _sum: { creatorPayout: true },
      where: { creatorId: creator.id, createdAt: { gte: thirtyDaysAgo }, type: "SLOT_ACTIVATION" },
    }),
  ]);

  const freeCount = postsByVisibility.find((p) => p.visibility === "FREE")?._count.id || 0;
  const premiumCount = postsByVisibility.find((p) => p.visibility === "PREMIUM")?._count.id || 0;

  res.json({
    totalViews: totalViews._sum.viewCount || 0,
    totalLikes: totalViews._sum.likeCount || 0,
    totalComments: totalViews._sum.commentCount || 0,
    newSubs30d: recentSubs,
    newSubs7d: weekSubs,
    earnings30d: recentEarnings._sum.creatorPayout || 0,
    topPosts,
    postBreakdown: { free: freeCount, premium: premiumCount },
    subscriberCount: creator.subscriberCount,
    pendingBalance: creator.pendingBalance,
    availableBalance: creator.availableBalance,
    totalEarned: creator.totalEarned,
  });
}));

// ══════════════════════════════════════════════════════════════════════
// ADMIN — U-Mate management
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/admin/umate/dashboard", requireAdmin, asyncHandler(async (_req, res) => {
  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalCreators,
    activeCreators,
    pendingReview,
    totalSubscriptions,
    activeSubscriptions,
    newSubsThisMonth,
    totalPosts,
    totalRevenue,
  ] = await Promise.all([
    prisma.umateCreator.count(),
    prisma.umateCreator.count({ where: { status: "ACTIVE" } }),
    prisma.umateCreator.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.umateSubscription.count(),
    prisma.umateSubscription.count({ where: { status: "ACTIVE", cycleEnd: { gt: now } } }),
    prisma.umateSubscription.count({ where: { createdAt: { gte: cycleStart } } }),
    prisma.umatePost.count(),
    prisma.umateLedgerEntry.aggregate({ _sum: { grossAmount: true }, where: { type: "PLAN_PURCHASE" } }),
  ]);

  const payoutPerSlot = await getUmateConfig("umate_payout_per_slot", 5000);
  const platformCommPct = await getUmateConfig("umate_platform_commission_pct", 0);
  const ivaPct = await getUmateConfig("umate_iva_pct", 19);

  // Platform earnings: sum of platformFee and ivaAmount from all slot activations
  const platformEarnings = await prisma.umateLedgerEntry.aggregate({
    _sum: { platformFee: true, ivaAmount: true },
    where: { type: "SLOT_ACTIVATION" },
  });

  res.json({
    totalCreators,
    activeCreators,
    pendingReview,
    totalSubscriptions,
    activeSubscriptions,
    newSubsThisMonth,
    totalPosts,
    totalRevenue: totalRevenue._sum.grossAmount || 0,
    totalCommissions: platformEarnings._sum.platformFee || 0,
    totalIva: platformEarnings._sum.ivaAmount || 0,
    config: { payoutPerSlot, platformCommPct, ivaPct },
  });
}));

umateRouter.get("/admin/umate/creators", requireAdmin, asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
  const offset = parseInt(String(req.query.offset || "0"), 10);

  const where: any = {};
  if (status) where.status = status;

  const [creators, total] = await Promise.all([
    prisma.umateCreator.findMany({
      where,
      include: { user: { select: { username: true, email: true, isVerified: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.umateCreator.count({ where }),
  ]);

  res.json({ creators, total });
}));

umateRouter.put("/admin/umate/creators/:id/status", requireAdmin, asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["DRAFT", "PENDING_TERMS", "PENDING_BANK", "PENDING_REVIEW", "ACTIVE", "SUSPENDED"].includes(status)) {
    return res.status(400).json({ error: "INVALID_STATUS" });
  }

  const updated = await prisma.umateCreator.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json({ creator: updated });
}));

umateRouter.get("/admin/umate/plans", requireAdmin, asyncHandler(async (_req, res) => {
  const plans = await prisma.umatePlan.findMany({ orderBy: { priceCLP: "asc" } });
  res.json({ plans });
}));

umateRouter.put("/admin/umate/plans/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { priceCLP, maxSlots, isActive, name } = req.body;
  const data: any = {};
  if (priceCLP !== undefined) {
    const price = parseInt(String(priceCLP), 10);
    if (isNaN(price) || price < 0) return res.status(400).json({ error: "INVALID_PRICE" });
    data.priceCLP = price;
  }
  if (maxSlots !== undefined) {
    const slots = parseInt(String(maxSlots), 10);
    if (isNaN(slots) || slots < 1) return res.status(400).json({ error: "INVALID_SLOTS" });
    data.maxSlots = slots;
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (name !== undefined) {
    const trimmed = String(name).trim();
    if (!trimmed) return res.status(400).json({ error: "INVALID_NAME" });
    data.name = trimmed;
  }

  const plan = await prisma.umatePlan.findUnique({ where: { id: req.params.id } });
  if (!plan) return res.status(404).json({ error: "NOT_FOUND" });

  const updated = await prisma.umatePlan.update({ where: { id: req.params.id }, data });
  res.json({ plan: updated });
}));

umateRouter.put("/admin/umate/config", requireAdmin, asyncHandler(async (req, res) => {
  const { payoutPerSlot, platformCommPct, ivaPct } = req.body;

  if (payoutPerSlot !== undefined) {
    const val = parseInt(String(payoutPerSlot), 10);
    if (isNaN(val) || val < 0) return res.status(400).json({ error: "INVALID_PAYOUT" });
    await prisma.platformConfig.upsert({
      where: { key: "umate_payout_per_slot" },
      update: { value: String(val) },
      create: { key: "umate_payout_per_slot", value: String(val) },
    });
  }
  if (platformCommPct !== undefined) {
    const val = parseInt(String(platformCommPct), 10);
    if (isNaN(val) || val < 0 || val > 100) return res.status(400).json({ error: "INVALID_COMMISSION" });
    await prisma.platformConfig.upsert({
      where: { key: "umate_platform_commission_pct" },
      update: { value: String(val) },
      create: { key: "umate_platform_commission_pct", value: String(val) },
    });
  }
  if (ivaPct !== undefined) {
    const val = parseInt(String(ivaPct), 10);
    if (isNaN(val) || val < 0 || val > 100) return res.status(400).json({ error: "INVALID_IVA" });
    await prisma.platformConfig.upsert({
      where: { key: "umate_iva_pct" },
      update: { value: String(val) },
      create: { key: "umate_iva_pct", value: String(val) },
    });
  }

  res.json({ ok: true });
}));

umateRouter.get("/admin/umate/ledger", requireAdmin, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || "50"), 10), 100);
  const offset = parseInt(String(req.query.offset || "0"), 10);
  const type = req.query.type as string | undefined;

  const where: any = {};
  if (type) where.type = type;

  const [entries, total] = await Promise.all([
    prisma.umateLedgerEntry.findMany({
      where,
      include: { creator: { select: { displayName: true, user: { select: { username: true } } } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.umateLedgerEntry.count({ where }),
  ]);

  res.json({ entries, total });
}));

umateRouter.get("/admin/umate/withdrawals", requireAdmin, asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined;
  const where: any = {};
  if (status) where.status = status;

  const withdrawals = await prisma.umateWithdrawal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({ withdrawals });
}));

umateRouter.put("/admin/umate/withdrawals/:id/approve", requireAdmin, asyncHandler(async (req, res) => {
  const w = await prisma.umateWithdrawal.findUnique({ where: { id: req.params.id } });
  if (!w || w.status !== "PENDING") return res.status(400).json({ error: "NOT_PENDING" });

  await prisma.umateWithdrawal.update({
    where: { id: w.id },
    data: { status: "APPROVED", reviewedBy: (req as any).user.id, reviewedAt: new Date() },
  });

  res.json({ approved: true });
}));

umateRouter.put("/admin/umate/withdrawals/:id/reject", requireAdmin, asyncHandler(async (req, res) => {
  const w = await prisma.umateWithdrawal.findUnique({ where: { id: req.params.id } });
  if (!w || w.status !== "PENDING") return res.status(400).json({ error: "NOT_PENDING" });

  // Refund balance to creator
  await prisma.$transaction(async (tx) => {
    await tx.umateWithdrawal.update({
      where: { id: w.id },
      data: { status: "REJECTED", reviewedBy: (req as any).user.id, reviewedAt: new Date(), rejectReason: req.body.reason },
    });
    await tx.umateCreator.update({
      where: { id: w.creatorId },
      data: { availableBalance: { increment: w.amount } },
    });
  });

  res.json({ rejected: true });
}));
