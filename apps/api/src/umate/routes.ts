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

/** Detect card brand from card number prefix (for display only) */
function detectCardBrand(cardNumber: string): string {
  const n = cardNumber.replace(/\D/g, "");
  if (/^4/.test(n)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  if (/^(6011|65|64[4-9])/.test(n)) return "discover";
  if (/^35/.test(n)) return "jcb";
  return "card";
}

/** Move matured pendingBalance to availableBalance for all eligible creators.
 *  Called opportunistically on creator stats/wallet reads. */
async function maturePendingBalances() {
  // Move pending balances to available immediately (no retention period)
  const creators = await prisma.umateCreator.findMany({
    where: { pendingBalance: { gt: 0 }, status: "ACTIVE" },
    select: { id: true, pendingBalance: true },
  });

  for (const creator of creators) {
    const maturedEntries = await prisma.umateLedgerEntry.findMany({
      where: {
        creatorId: creator.id,
        type: "SLOT_ACTIVATION",
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

/** Check if user is subscribed to a specific creator (via plan slot OR direct per-creator sub) */
async function isSubscribedToCreator(userId: string, creatorId: string): Promise<boolean> {
  // Legacy plan-slot subscription
  const sub = await prisma.umateCreatorSub.findFirst({
    where: { subscriberId: userId, creatorId, expiresAt: { gt: new Date() } },
  });
  if (sub) return true;

  // Direct per-creator subscription (OnlyFans-style)
  const direct = await prisma.umateDirectSubscription.findFirst({
    where: {
      userId,
      creatorId,
      status: { in: ["ACTIVE", "CANCELLED"] }, // CANCELLED still has access until period end
      currentPeriodEnd: { gt: new Date() },
    },
  });
  return Boolean(direct);
}

/** Get all creatorIds the user is subscribed to (via either model) */
async function getSubscribedCreatorIds(userId: string): Promise<Set<string>> {
  const [slotSubs, directSubs] = await Promise.all([
    prisma.umateCreatorSub.findMany({
      where: { subscriberId: userId, expiresAt: { gt: new Date() } },
      select: { creatorId: true },
    }),
    prisma.umateDirectSubscription.findMany({
      where: {
        userId,
        status: { in: ["ACTIVE", "CANCELLED"] },
        currentPeriodEnd: { gt: new Date() },
      },
      select: { creatorId: true },
    }),
  ]);
  return new Set([...slotSubs.map((s) => s.creatorId), ...directSubs.map((s) => s.creatorId)]);
}

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

  // Determine which creators the user is subscribed to (plan slot OR direct)
  let subscribedCreatorIds = new Set<string>();
  let likedPostIds = new Set<string>();
  if (userId) {
    subscribedCreatorIds = await getSubscribedCreatorIds(userId);

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
      media: post.media.map((m: any) => {
        const blurred = m.visibility === "PREMIUM" && !isSubscribed;
        return {
          ...m,
          url: blurred ? null : m.url,
          thumbnailUrl: blurred ? null : m.thumbnailUrl,
          isBlurred: blurred,
        };
      }),
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
      monthlyPriceCLP: true,
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
      monthlyPriceCLP: true,
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
      media: post.media.map((m: any) => {
        const blurred = m.visibility === "PREMIUM" && !isSubscribed;
        return {
          ...m,
          url: blurred ? null : m.url,
          thumbnailUrl: blurred ? null : m.thumbnailUrl,
          isBlurred: blurred,
        };
      }),
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

  // Active subscribers cannot become creators — role restriction
  const activeDirectSub = await prisma.umateDirectSubscription.findFirst({
    where: { userId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
  });
  if (activeDirectSub) {
    return res.status(403).json({ error: "SUBSCRIBER_CANNOT_CREATE", message: "Los suscriptores activos no pueden crear cuenta de creadora. Cancela tus suscripciones primero." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { displayName: true, bio: true, avatarUrl: true, coverUrl: true, profileType: true, isVerified: true },
  });

  // Express onboarding: verified professionals with complete profiles skip DRAFT
  const hasCompleteProfile = user?.displayName && user?.bio && user?.avatarUrl;
  const isProfessional = user?.profileType === "PROFESSIONAL" && user?.isVerified;
  const initialStatus = (isProfessional && hasCompleteProfile) ? "PENDING_BANK" : "DRAFT";

  const creator = await prisma.umateCreator.create({
    data: {
      userId,
      displayName: user?.displayName || "Creadora",
      bio: user?.bio,
      avatarUrl: user?.avatarUrl,
      coverUrl: user?.coverUrl,
      status: initialStatus,
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

  // Direct (per-creator) subscriptions — ACTIVE or CANCELLED still in period
  const directSubs = await prisma.umateDirectSubscription.findMany({
    where: {
      creatorId: creator.id,
      currentPeriodEnd: { gt: now },
      status: { in: ["ACTIVE", "CANCELLED"] },
    },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { startedAt: "desc" },
  });

  const subscribers = directSubs.map((s) => ({
    id: s.id,
    activatedAt: s.startedAt,
    expiresAt: s.currentPeriodEnd,
    priceCLP: s.priceCLP,
    status: s.status,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    cardBrand: s.cardBrand,
    cardLast4: s.cardLast4,
    user: s.user,
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

  // Get creators the user is NOT subscribed to (legacy slot OR direct)
  let excludeCreatorIds: string[] = [];
  if (userId) {
    const subscribed = await getSubscribedCreatorIds(userId);
    excludeCreatorIds = Array.from(subscribed);
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
      monthlyPriceCLP: true,
      user: { select: { username: true, isVerified: true } },
    },
    orderBy: [{ subscriberCount: "desc" }, { totalLikes: "desc" }],
    take: limit,
  });

  res.json({ creators });
}));

// ══════════════════════════════════════════════════════════════════════
// DIRECT SUBSCRIPTIONS (OnlyFans-style, per-creator, PAC recurring)
// ══════════════════════════════════════════════════════════════════════

/** Creator sets her own monthly subscription price */
umateRouter.put("/umate/creator/price", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { monthlyPriceCLP } = req.body as { monthlyPriceCLP: number };

  const priceInt = Math.round(Number(monthlyPriceCLP));
  if (!Number.isFinite(priceInt) || priceInt < 1000 || priceInt > 200000) {
    return res.status(400).json({ error: "INVALID_PRICE", message: "El precio debe estar entre $1.000 y $200.000 CLP." });
  }

  const creator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (!creator) return res.status(404).json({ error: "NOT_CREATOR" });

  const updated = await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { monthlyPriceCLP: priceInt },
    select: { id: true, monthlyPriceCLP: true },
  });

  res.json({ creator: updated });
}));

/** Subscribe directly to a specific creator using PAC (recurring card charge).
 *  Body: { cardNumber, cardHolderName, cardExp, cardCvv }  (sandbox — last4 stored only) */
umateRouter.post("/umate/creators/:creatorId/subscribe-direct", requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { creatorId } = req.params;
  const { cardNumber, cardHolderName, cardExp, cardCvv } = req.body as {
    cardNumber?: string;
    cardHolderName?: string;
    cardExp?: string;
    cardCvv?: string;
  };

  const creator = await prisma.umateCreator.findUnique({ where: { id: creatorId } });
  if (!creator || creator.status !== "ACTIVE") {
    return res.status(404).json({ error: "CREATOR_NOT_FOUND" });
  }

  if (creator.userId === userId) {
    return res.status(400).json({ error: "CANNOT_SUBSCRIBE_SELF" });
  }

  // Creators cannot subscribe to other creators
  const userIsCreator = await prisma.umateCreator.findUnique({ where: { userId } });
  if (userIsCreator && userIsCreator.status !== "SUSPENDED") {
    return res.status(403).json({ error: "CREATOR_CANNOT_SUBSCRIBE", message: "Las creadoras no pueden suscribirse a perfiles. Usa una cuenta de cliente." });
  }

  // Validate card input
  const digitsOnly = (cardNumber || "").replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(digitsOnly)) {
    return res.status(400).json({ error: "INVALID_CARD", message: "Número de tarjeta inválido." });
  }
  if (!cardHolderName || cardHolderName.trim().length < 2) {
    return res.status(400).json({ error: "INVALID_HOLDER", message: "Nombre del titular requerido." });
  }
  if (!/^\d{2}\/\d{2}$/.test(cardExp || "")) {
    return res.status(400).json({ error: "INVALID_EXP", message: "Fecha de expiración inválida (MM/AA)." });
  }
  if (!/^\d{3,4}$/.test(cardCvv || "")) {
    return res.status(400).json({ error: "INVALID_CVV", message: "CVV inválido." });
  }

  const last4 = digitsOnly.slice(-4);
  const brand = detectCardBrand(digitsOnly);

  // Check if already subscribed (active or cancelled-but-period-remaining)
  const existing = await prisma.umateDirectSubscription.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  if (existing && existing.status === "ACTIVE" && existing.currentPeriodEnd > now) {
    return res.status(400).json({ error: "ALREADY_SUBSCRIBED", message: "Ya estás suscrito a esta creadora." });
  }

  // Economics (snapshot)
  const platformCommPct = await getUmateConfig("umate_platform_commission_pct", 15);
  const ivaPct = await getUmateConfig("umate_iva_pct", 19);
  const gross = creator.monthlyPriceCLP;
  const ivaAmount = Math.round(gross * ivaPct / (100 + ivaPct));
  const netAfterIva = gross - ivaAmount;
  const platformFee = Math.round(netAfterIva * platformCommPct / 100);
  const creatorPayout = netAfterIva - platformFee;

  // Create payment intent (PAC mandate simulated)
  const intent = await prisma.paymentIntent.create({
    data: {
      subscriberId: userId,
      purpose: "UMATE_PLAN",
      method: "FLOW",
      status: "PAID", // Sandbox: immediate confirmation
      amount: gross,
      paidAt: now,
      notes: JSON.stringify({ kind: "umate_direct_subscription", creatorId, last4, brand }),
    },
  });

  // Simulated PAC mandate id (in production this comes from Flow/Khipu)
  const pacMandateId = `pac_${intent.id.replace(/-/g, "").slice(0, 20)}`;

  const sub = await prisma.$transaction(async (tx) => {
    let record;
    if (existing) {
      record = await tx.umateDirectSubscription.update({
        where: { id: existing.id },
        data: {
          priceCLP: gross,
          cardBrand: brand,
          cardLast4: last4,
          cardHolderName: cardHolderName.trim(),
          pacMandateId,
          paymentIntentId: intent.id,
          status: "ACTIVE",
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      record = await tx.umateDirectSubscription.create({
        data: {
          userId,
          creatorId,
          priceCLP: gross,
          cardBrand: brand,
          cardLast4: last4,
          cardHolderName: cardHolderName.trim(),
          pacMandateId,
          paymentIntentId: intent.id,
          status: "ACTIVE",
          startedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    await tx.umateCreator.update({
      where: { id: creatorId },
      data: {
        subscriberCount: { increment: existing ? 0 : 1 },
        pendingBalance: { increment: creatorPayout },
        totalEarned: { increment: creatorPayout },
      },
    });

    await tx.umateLedgerEntry.create({
      data: {
        creatorId,
        type: "SLOT_ACTIVATION",
        grossAmount: gross,
        platformFee,
        ivaAmount,
        creatorPayout,
        netAmount: creatorPayout,
        description: `Suscripción directa (PAC) — $${gross.toLocaleString("es-CL")} CLP`,
        referenceId: record.id,
        referenceType: "direct_subscription",
      },
    });

    return record;
  });

  // Notify creator
  prisma.notification.create({
    data: {
      userId: creator.userId,
      type: "UMATE_NEW_SUBSCRIBER",
      data: { subscriberId: userId, creatorId, direct: true },
    },
  }).then(() => {
    sendToUser(creator.userId, "umate:new_subscriber", { creatorId });
  }).catch(() => {});

  res.json({
    subscribed: true,
    subscription: {
      id: sub.id,
      status: sub.status,
      priceCLP: sub.priceCLP,
      cardBrand: sub.cardBrand,
      cardLast4: sub.cardLast4,
      currentPeriodEnd: sub.currentPeriodEnd,
    },
  });
}));

/** List my direct subscriptions (for "Mis suscripciones" page) */
umateRouter.get("/umate/my-subscriptions", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;

  const subs = await prisma.umateDirectSubscription.findMany({
    where: {
      userId,
      OR: [
        { status: "ACTIVE" },
        { status: "CANCELLED", currentPeriodEnd: { gt: new Date() } },
      ],
    },
    include: {
      creator: {
        select: {
          id: true,
          displayName: true,
          avatarUrl: true,
          monthlyPriceCLP: true,
          user: { select: { username: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({
    subscriptions: subs.map((s) => ({
      id: s.id,
      status: s.status,
      priceCLP: s.priceCLP,
      cardBrand: s.cardBrand,
      cardLast4: s.cardLast4,
      cardHolderName: s.cardHolderName,
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      startedAt: s.startedAt,
      currentPeriodStart: s.currentPeriodStart,
      currentPeriodEnd: s.currentPeriodEnd,
      cancelledAt: s.cancelledAt,
      creator: {
        id: s.creator.id,
        displayName: s.creator.displayName,
        avatarUrl: s.creator.avatarUrl,
        username: s.creator.user?.username,
      },
    })),
  });
}));

/** Cancel a direct subscription at period end (access continues until currentPeriodEnd) */
umateRouter.post("/umate/direct-subscriptions/:id/cancel", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const sub = await prisma.umateDirectSubscription.findUnique({ where: { id } });
  if (!sub || sub.userId !== userId) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (sub.status !== "ACTIVE") {
    return res.status(400).json({ error: "NOT_ACTIVE", message: "Esta suscripción ya fue cancelada." });
  }

  const updated = await prisma.umateDirectSubscription.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelAtPeriodEnd: true,
      cancelledAt: new Date(),
    },
  });

  res.json({
    cancelled: true,
    subscription: {
      id: updated.id,
      status: updated.status,
      currentPeriodEnd: updated.currentPeriodEnd,
    },
  });
}));

/** Reactivate a subscription that was cancelled but still in period */
umateRouter.post("/umate/direct-subscriptions/:id/reactivate", requireAuth, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { id } = req.params;

  const sub = await prisma.umateDirectSubscription.findUnique({ where: { id } });
  if (!sub || sub.userId !== userId) {
    return res.status(404).json({ error: "NOT_FOUND" });
  }

  if (sub.status !== "CANCELLED" || sub.currentPeriodEnd <= new Date()) {
    return res.status(400).json({ error: "CANNOT_REACTIVATE" });
  }

  const updated = await prisma.umateDirectSubscription.update({
    where: { id },
    data: {
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
  });

  res.json({ reactivated: true, subscription: { id: updated.id, status: updated.status } });
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
    prisma.umateDirectSubscription.count(),
    prisma.umateDirectSubscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: now } } }),
    prisma.umateDirectSubscription.count({ where: { createdAt: { gte: cycleStart } } }),
    prisma.umatePost.count(),
    prisma.umateLedgerEntry.aggregate({ _sum: { grossAmount: true }, where: { type: "SLOT_ACTIVATION" } }),
  ]);

  const platformCommPct = await getUmateConfig("umate_platform_commission_pct", 15);
  const ivaPct = await getUmateConfig("umate_iva_pct", 19);

  // Platform earnings: sum of platformFee and ivaAmount from all direct subscription activations
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
    config: { platformCommPct, ivaPct },
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

umateRouter.put("/admin/umate/config", requireAdmin, asyncHandler(async (req, res) => {
  const { platformCommPct, ivaPct } = req.body;

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
