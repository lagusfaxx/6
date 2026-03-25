import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../db";
import { config } from "../config";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { optimizeImage } from "../lib/imageOptimizer";
import { validateUploadedFile } from "../lib/uploads";

export const umateRouter = Router();

const storage = new LocalStorageProvider(
  path.join(process.cwd(), config.storageDir),
  "/uploads",
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
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

umateRouter.get("/umate/plans", async (_req, res) => {
  const plans = await prisma.umatePlan.findMany({
    where: { isActive: true },
    orderBy: { priceCLP: "asc" },
  });
  res.json({ plans });
});

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Feed / Explore
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/feed", async (req, res) => {
  const userId = (req as any).user?.id;
  const limit = Math.min(parseInt(String(req.query.limit || "20"), 10) || 20, 50);
  const offset = parseInt(String(req.query.offset || "0"), 10) || 0;
  const filter = req.query.filter as string | undefined; // "free", "premium", or undefined

  const where: any = {
    creator: { status: "ACTIVE" },
  };
  if (filter === "free") where.visibility = "FREE";
  if (filter === "premium") where.visibility = "PREMIUM";

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
    const showContent = post.visibility === "FREE" || isSubscribed;
    return {
      id: post.id,
      caption: post.caption,
      visibility: post.visibility,
      likeCount: post.likeCount,
      viewCount: post.viewCount,
      createdAt: post.createdAt,
      creator: post.creator,
      media: showContent
        ? post.media
        : post.media.map((m) => ({ ...m, url: null })),
      isBlurred: !showContent,
      isLiked: likedPostIds.has(post.id),
    };
  });

  res.json({ items });
});

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Explore creators
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creators", async (req, res) => {
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
});

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Creator profile
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/profile/:username", async (req, res) => {
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

  let likedPostIds = new Set<string>();
  if (userId) {
    const likes = await prisma.umateLike.findMany({
      where: { userId, postId: { in: posts.map((p) => p.id) } },
      select: { postId: true },
    });
    likedPostIds = new Set(likes.map((l) => l.postId));
  }

  const postsWithAccess = posts.map((post) => {
    const showContent = post.visibility === "FREE" || isSubscribed;
    return {
      ...post,
      media: showContent
        ? post.media
        : post.media.map((m) => ({ ...m, url: null })),
      isBlurred: !showContent,
      isLiked: likedPostIds.has(post.id),
    };
  });

  res.json({
    creator,
    isSubscribed,
    posts: postsWithAccess,
  });
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Like / Unlike
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/posts/:postId/like", requireAuth, async (req, res) => {
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
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Subscribe to plan (checkout)
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/subscribe", requireAuth, async (req, res) => {
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
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Activate plan after payment confirmation
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/subscription/status", requireAuth, async (req, res) => {
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
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Use a slot to subscribe to a creator
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/creators/:creatorId/subscribe", requireAuth, async (req, res) => {
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

  // Activate slot
  const payoutPerSlot = await getUmateConfig("umate_payout_per_slot", 5000);
  const platformCommPct = await getUmateConfig("umate_platform_commission_pct", 0);

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
          pendingBalance: { increment: payoutPerSlot },
          totalEarned: { increment: payoutPerSlot },
        },
      });

      // Ledger: slot activation
      const platformFee = Math.round(payoutPerSlot * platformCommPct / 100);
      await tx.umateLedgerEntry.create({
        data: {
          creatorId,
          type: "SLOT_ACTIVATION",
          grossAmount: payoutPerSlot,
          platformFee,
          creatorPayout: payoutPerSlot - platformFee,
          netAmount: payoutPerSlot - platformFee,
          description: `Suscripción de usuario`,
          referenceId: sub.id,
          referenceType: "subscription",
        },
      });

      return { slotsUsed: freshSub.slotsUsed + 1, slotsTotal: freshSub.slotsTotal };
    });

    res.json({ subscribed: true, slotsUsed: result.slotsUsed, slotsTotal: result.slotsTotal });
  } catch (err: any) {
    if (err?.message === "NO_SLOTS") {
      return res.status(400).json({ error: "NO_SLOTS", message: "No tienes cupos disponibles este ciclo." });
    }
    throw err;
  }
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator onboarding
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creator/me", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({
    where: { userId },
    include: { user: { select: { username: true, displayName: true, avatarUrl: true, isVerified: true, profileType: true } } },
  });
  res.json({ creator });
});

umateRouter.post("/umate/creator/onboard", requireAuth, async (req, res) => {
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
});

umateRouter.put("/umate/creator/profile", requireAuth, async (req, res) => {
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
});

umateRouter.put("/umate/creator/bank", requireAuth, async (req, res) => {
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
});

umateRouter.post("/umate/creator/accept-terms", requireAuth, async (req, res) => {
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
});

umateRouter.post("/umate/creator/avatar", requireAuth, upload.single("file"), async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "NO_FILE" });

  const saved = await storage.save({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    folder: "umate-avatars",
  });

  await prisma.umateCreator.update({ where: { id: creator.id }, data: { avatarUrl: saved.url } });
  res.json({ url: saved.url });
});

umateRouter.post("/umate/creator/cover", requireAuth, upload.single("file"), async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const file = req.file;
  if (!file) return res.status(400).json({ error: "NO_FILE" });

  const saved = await storage.save({
    buffer: file.buffer,
    filename: file.originalname,
    mimeType: file.mimetype,
    folder: "umate-covers",
  });

  await prisma.umateCreator.update({ where: { id: creator.id }, data: { coverUrl: saved.url } });
  res.json({ url: saved.url });
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator content management
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/posts", requireAuth, upload.array("files", 10), async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator || creator.status !== "ACTIVE") {
    return res.status(403).json({ error: "NOT_ACTIVE_CREATOR" });
  }

  const { caption, visibility } = req.body;
  const files = req.files as Express.Multer.File[];
  if (!files?.length) return res.status(400).json({ error: "NO_FILES" });

  const mediaItems: { type: "IMAGE" | "VIDEO"; url: string; pos: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    const saved = await storage.save({
      buffer: files[i].buffer,
      filename: files[i].originalname,
      mimeType: files[i].mimetype,
      folder: "umate-posts",
    });
    mediaItems.push({
      type: saved.type === "video" ? "VIDEO" : "IMAGE",
      url: saved.url,
      pos: i,
    });
  }

  const post = await prisma.umatePost.create({
    data: {
      creatorId: creator.id,
      caption: caption || null,
      visibility: visibility === "PREMIUM" ? "PREMIUM" : "FREE",
      media: { create: mediaItems },
    },
    include: { media: true },
  });

  await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { totalPosts: { increment: 1 } },
  });

  res.json({ post });
});

umateRouter.get("/umate/creator/posts", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const posts = await prisma.umatePost.findMany({
    where: { creatorId: creator.id },
    include: { media: { orderBy: { pos: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  res.json({ posts });
});

umateRouter.delete("/umate/posts/:postId", requireAuth, async (req, res) => {
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
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator dashboard stats
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/creator/stats", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const now = new Date();
  const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [newSubsThisCycle, recentLedger] = await Promise.all([
    prisma.umateCreatorSub.count({
      where: { creatorId: creator.id, activatedAt: { gte: cycleStart } },
    }),
    prisma.umateLedgerEntry.findMany({
      where: { creatorId: creator.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  res.json({
    subscriberCount: creator.subscriberCount,
    newSubsThisCycle,
    totalPosts: creator.totalPosts,
    totalLikes: creator.totalLikes,
    pendingBalance: creator.pendingBalance,
    availableBalance: creator.availableBalance,
    totalEarned: creator.totalEarned,
    status: creator.status,
    ledger: recentLedger,
    bankConfigured: Boolean(creator.bankName),
    termsAccepted: Boolean(creator.termsAcceptedAt),
    rulesAccepted: Boolean(creator.rulesAcceptedAt),
    contractAccepted: Boolean(creator.contractAcceptedAt),
  });
});

// ══════════════════════════════════════════════════════════════════════
// AUTH — Creator withdrawals
// ══════════════════════════════════════════════════════════════════════

umateRouter.post("/umate/creator/withdraw", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
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
        grossAmount: amount,
        creatorPayout: amount,
        netAmount: amount,
        description: `Retiro solicitado`,
        referenceType: "withdrawal",
      },
    });
  });

  res.json({ withdrawn: amount });
});

umateRouter.get("/umate/creator/withdrawals", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const withdrawals = await prisma.umateWithdrawal.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  res.json({ withdrawals });
});

// ══════════════════════════════════════════════════════════════════════
// ADMIN — U-Mate management
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/admin/umate/dashboard", requireAdmin, async (_req, res) => {
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

  res.json({
    totalCreators,
    activeCreators,
    pendingReview,
    totalSubscriptions,
    activeSubscriptions,
    newSubsThisMonth,
    totalPosts,
    totalRevenue: totalRevenue._sum.grossAmount || 0,
    config: { payoutPerSlot, platformCommPct },
  });
});

umateRouter.get("/admin/umate/creators", requireAdmin, async (req, res) => {
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
});

umateRouter.put("/admin/umate/creators/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["DRAFT", "PENDING_TERMS", "PENDING_BANK", "PENDING_REVIEW", "ACTIVE", "SUSPENDED"].includes(status)) {
    return res.status(400).json({ error: "INVALID_STATUS" });
  }

  const updated = await prisma.umateCreator.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json({ creator: updated });
});

umateRouter.get("/admin/umate/plans", requireAdmin, async (_req, res) => {
  const plans = await prisma.umatePlan.findMany({ orderBy: { priceCLP: "asc" } });
  res.json({ plans });
});

umateRouter.put("/admin/umate/plans/:id", requireAdmin, async (req, res) => {
  const { priceCLP, maxSlots, isActive, name } = req.body;
  const data: any = {};
  if (priceCLP !== undefined) data.priceCLP = priceCLP;
  if (maxSlots !== undefined) data.maxSlots = maxSlots;
  if (isActive !== undefined) data.isActive = isActive;
  if (name !== undefined) data.name = name;

  const updated = await prisma.umatePlan.update({ where: { id: req.params.id }, data });
  res.json({ plan: updated });
});

umateRouter.put("/admin/umate/config", requireAdmin, async (req, res) => {
  const { payoutPerSlot, platformCommPct } = req.body;

  if (payoutPerSlot !== undefined) {
    await prisma.platformConfig.upsert({
      where: { key: "umate_payout_per_slot" },
      update: { value: String(payoutPerSlot) },
      create: { key: "umate_payout_per_slot", value: String(payoutPerSlot) },
    });
  }
  if (platformCommPct !== undefined) {
    await prisma.platformConfig.upsert({
      where: { key: "umate_platform_commission_pct" },
      update: { value: String(platformCommPct) },
      create: { key: "umate_platform_commission_pct", value: String(platformCommPct) },
    });
  }

  res.json({ ok: true });
});

umateRouter.get("/admin/umate/ledger", requireAdmin, async (req, res) => {
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
});

umateRouter.get("/admin/umate/withdrawals", requireAdmin, async (req, res) => {
  const status = req.query.status as string | undefined;
  const where: any = {};
  if (status) where.status = status;

  const withdrawals = await prisma.umateWithdrawal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({ withdrawals });
});

umateRouter.put("/admin/umate/withdrawals/:id/approve", requireAdmin, async (req, res) => {
  const w = await prisma.umateWithdrawal.findUnique({ where: { id: req.params.id } });
  if (!w || w.status !== "PENDING") return res.status(400).json({ error: "NOT_PENDING" });

  await prisma.umateWithdrawal.update({
    where: { id: w.id },
    data: { status: "APPROVED", reviewedBy: (req as any).user.id, reviewedAt: new Date() },
  });

  res.json({ approved: true });
});

umateRouter.put("/admin/umate/withdrawals/:id/reject", requireAdmin, async (req, res) => {
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
});
