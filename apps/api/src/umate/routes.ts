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
import { sendUmatePromotionalEmail } from "../lib/notificationEmail";
import { signMedia, verifyMediaSig } from "./mediaSigning";
import {
  PRIVATE_PREFIX,
  isPrivateRef,
  privateRefToRelPath,
  savePrivate,
  streamPrivateFile,
} from "./privateStorage";
import {
  createFlowCustomer,
  registerFlowCustomer,
  getFlowRegisterStatus,
  createFlowPlan,
  editFlowPlan,
  createFlowSubscription,
  getFlowSubscription,
  cancelFlowSubscription,
} from "../khipu/client";

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

/** Extract first frame from a video buffer and save as JPEG thumbnail. When `privateAsset` is true,
 *  the thumbnail is stored in the private umate storage (never served via /uploads). */
async function extractVideoThumbnail(
  videoBuffer: Buffer,
  originalFilename: string,
  opts: { privateAsset?: boolean } = {},
): Promise<string | null> {
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
    let resultUrl: string;
    if (opts.privateAsset) {
      const saved = await savePrivate({
        buffer: thumbBuffer,
        originalName: "thumb.jpg",
        mimeType: "image/jpeg",
        folder: "umate-thumbs",
      });
      resultUrl = saved.url;
    } else {
      const saved = await storage.save({
        buffer: thumbBuffer,
        filename: "thumb.jpg",
        mimeType: "image/jpeg",
        folder: "umate-thumbs",
      });
      resultUrl = saved.url;
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    return resultUrl;
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

/** Build a Flow-safe planId for a creator. Flow planIds accept alphanumerics + underscore.
 *  Format: UMATE_<12-hex-prefix-of-creator-uuid>_<priceCLP>
 *  The price is embedded so that if the creator changes price we can detect drift. */
function buildFlowPlanId(creatorId: string, priceCLP: number): string {
  const hex = creatorId.replace(/-/g, "").slice(0, 12).toUpperCase();
  return `UMATE_${hex}_${priceCLP}`;
}

/** Ensure the creator has an up-to-date Flow plan matching her current monthly price.
 *  Creates the plan the first time; edits the existing plan's amount if the price changed.
 *  Returns the planId to use for new Flow subscriptions. */
async function ensureCreatorFlowPlan(creator: { id: string; displayName: string; monthlyPriceCLP: number; flowPlanId: string | null }): Promise<string> {
  const desiredPlanId = buildFlowPlanId(creator.id, creator.monthlyPriceCLP);
  const apiUrl = config.apiUrl.replace(/\/$/, "");
  const callbackUrl = `${apiUrl}/webhooks/flow/subscription`;

  // If we already have a plan that matches the current price, reuse it
  if (creator.flowPlanId === desiredPlanId) {
    return desiredPlanId;
  }

  // If there is a stale plan for an older price, try to edit its amount first.
  // Flow plans have immutable planIds, so we always try to keep a single plan per creator
  // and mutate its amount when the tariff changes. If edit fails we fall back to creating a
  // brand-new planId (embedded new price), which keeps historical billings intact.
  if (creator.flowPlanId) {
    try {
      await editFlowPlan({
        planId: creator.flowPlanId,
        amount: creator.monthlyPriceCLP,
        urlCallback: callbackUrl,
      });
      return creator.flowPlanId;
    } catch (err) {
      console.warn("[umate] editFlowPlan failed, creating new plan", { creatorId: creator.id, err: (err as Error)?.message });
    }
  }

  // Create a fresh plan
  await createFlowPlan({
    planId: desiredPlanId,
    name: `U-Mate — ${creator.displayName}`.slice(0, 100),
    currency: "CLP",
    amount: creator.monthlyPriceCLP,
    interval: 3, // 3 = monthly in Flow
    interval_count: 1,
    trial_period_days: 0,
    urlCallback: callbackUrl,
  });

  await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { flowPlanId: desiredPlanId },
  });

  return desiredPlanId;
}

/** Credit creator balance + ledger entry for a single monthly charge (initial or renewal). */
async function creditCreatorForDirectSub(params: {
  creatorId: string;
  subscriptionId: string;
  gross: number;
  description: string;
}): Promise<void> {
  const platformCommPct = await getUmateConfig("umate_platform_commission_pct", 15);
  const ivaPct = await getUmateConfig("umate_iva_pct", 19);

  const gross = params.gross;
  const ivaAmount = Math.round(gross * ivaPct / (100 + ivaPct));
  const netAfterIva = gross - ivaAmount;
  const platformFee = Math.round(netAfterIva * platformCommPct / 100);
  const creatorPayout = netAfterIva - platformFee;

  await prisma.$transaction(async (tx) => {
    await tx.umateCreator.update({
      where: { id: params.creatorId },
      data: {
        pendingBalance: { increment: creatorPayout },
        totalEarned: { increment: creatorPayout },
      },
    });

    await tx.umateLedgerEntry.create({
      data: {
        creatorId: params.creatorId,
        type: "SLOT_ACTIVATION",
        grossAmount: gross,
        platformFee,
        ivaAmount,
        creatorPayout,
        netAmount: creatorPayout,
        description: params.description,
        referenceId: params.subscriptionId,
        referenceType: "direct_subscription",
      },
    });
  });
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

/** Check if the viewer is an admin (by email or by role). Admins bypass all paywalls. */
function isAdminUser(user: { email?: string | null; role?: string | null } | undefined | null): boolean {
  if (!user) return false;
  if (user.email && user.email === config.adminEmail) return true;
  return (user.role || "").toUpperCase() === "ADMIN";
}

/** Build a signed URL that serves a private UmatePostMedia asset via GET /umate/media/:id.
 *  Returns null if the input is not a private reference. */
function buildSignedMediaUrl(mediaId: string, subject: "asset" | "thumb"): string {
  const base = (config.apiUrl || "").replace(/\/$/, "");
  const signingSubject = `${mediaId}:${subject}`;
  const { exp, sig } = signMedia(signingSubject);
  const suffix = subject === "thumb" ? "/thumb" : "";
  return `${base}/umate/media/${encodeURIComponent(mediaId)}${suffix}?exp=${exp}&sig=${encodeURIComponent(sig)}`;
}

/** Given a (possibly private) url + thumbnail from a UmatePostMedia row, rewrite private refs
 *  to freshly signed URLs. Non-private URLs are returned unchanged. */
function rewritePrivateMediaUrls(mediaId: string, url: string | null, thumbnailUrl: string | null): { url: string | null; thumbnailUrl: string | null } {
  return {
    url: isPrivateRef(url) ? buildSignedMediaUrl(mediaId, "asset") : url,
    thumbnailUrl: isPrivateRef(thumbnailUrl) ? buildSignedMediaUrl(mediaId, "thumb") : thumbnailUrl,
  };
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
// PUBLIC — Signed media streaming for PREMIUM umate assets
// The signature (HMAC of mediaId + exp + subject, TTL 1h) is the auth here;
// no session is required so the video element can load the src without cookies.
// ══════════════════════════════════════════════════════════════════════

async function handleSignedMedia(req: import("express").Request, res: import("express").Response, subject: "asset" | "thumb") {
  const mediaId = String(req.params.mediaId || "");
  const exp = parseInt(String(req.query.exp || ""), 10);
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  if (!mediaId || !exp || !sig) {
    return res.status(400).json({ error: "BAD_SIGNATURE" });
  }
  const signingSubject = `${mediaId}:${subject}`;
  if (!verifyMediaSig(signingSubject, exp, sig)) {
    return res.status(403).json({ error: "BAD_SIGNATURE" });
  }
  const media = await prisma.umatePostMedia.findUnique({
    where: { id: mediaId },
    select: { url: true, thumbnailUrl: true },
  });
  if (!media) return res.status(404).json({ error: "NOT_FOUND" });
  const source = subject === "thumb" ? media.thumbnailUrl : media.url;
  if (!source || !isPrivateRef(source)) return res.status(404).json({ error: "NOT_PRIVATE" });
  const relPath = privateRefToRelPath(source);
  if (!relPath) return res.status(404).json({ error: "NOT_FOUND" });
  await streamPrivateFile(relPath, req, res);
}

umateRouter.get("/umate/media/:mediaId", asyncHandler((req, res) => handleSignedMedia(req, res, "asset")));
umateRouter.head("/umate/media/:mediaId", asyncHandler((req, res) => handleSignedMedia(req, res, "asset")));
umateRouter.get("/umate/media/:mediaId/thumb", asyncHandler((req, res) => handleSignedMedia(req, res, "thumb")));
umateRouter.head("/umate/media/:mediaId/thumb", asyncHandler((req, res) => handleSignedMedia(req, res, "thumb")));

// ══════════════════════════════════════════════════════════════════════
// PUBLIC — Feed / Explore
// ══════════════════════════════════════════════════════════════════════

umateRouter.get("/umate/feed", asyncHandler(async (req, res) => {
  const viewer = (req as any).user;
  const userId = viewer?.id;
  const viewerIsAdmin = isAdminUser(viewer);
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
    const canViewPremium = viewerIsAdmin || subscribedCreatorIds.has(post.creatorId);
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
        const blurred = m.visibility === "PREMIUM" && !canViewPremium;
        const rewritten = blurred ? { url: null, thumbnailUrl: null } : rewritePrivateMediaUrls(m.id, m.url, m.thumbnailUrl);
        return {
          ...m,
          url: rewritten.url,
          thumbnailUrl: rewritten.thumbnailUrl,
          isBlurred: blurred,
        };
      }),
      isBlurred: post.visibility === "PREMIUM" && !canViewPremium,
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

  const genderParam =
    typeof req.query.gender === "string" ? req.query.gender.toUpperCase() : "";
  const genderFilter =
    genderParam === "MALE" || genderParam === "FEMALE" || genderParam === "OTHER"
      ? (genderParam as "MALE" | "FEMALE" | "OTHER")
      : null;

  const where: any = { status: "ACTIVE" };
  if (q) {
    where.displayName = { contains: q, mode: "insensitive" };
  }
  if (genderFilter === "FEMALE") {
    where.user = { OR: [{ gender: "FEMALE" }, { gender: null }] };
  } else if (genderFilter) {
    where.user = { gender: genderFilter };
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
  const viewer = (req as any).user;
  const userId = viewer?.id;
  const viewerIsAdmin = isAdminUser(viewer);

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

  const isSubscribed = userId && !viewerIsAdmin ? await isSubscribedToCreator(userId, creator.id) : false;
  const canViewPremium = viewerIsAdmin || isSubscribed;

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
        const blurred = m.visibility === "PREMIUM" && !canViewPremium;
        const rewritten = blurred ? { url: null, thumbnailUrl: null } : rewritePrivateMediaUrls(m.id, m.url, m.thumbnailUrl);
        return {
          ...m,
          url: rewritten.url,
          thumbnailUrl: rewritten.thumbnailUrl,
          isBlurred: blurred,
        };
      }),
      isBlurred: post.visibility === "PREMIUM" && !canViewPremium,
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

  const { terms, rules, contract, termsVersion, rulesVersion, contractVersion } = req.body as {
    terms?: boolean;
    rules?: boolean;
    contract?: boolean;
    termsVersion?: string;
    rulesVersion?: string;
    contractVersion?: string;
  };

  // Extract forensic proof from request
  const ipRaw =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string | undefined) ||
    req.ip ||
    req.socket.remoteAddress ||
    null;
  const ip = ipRaw ? String(ipRaw).slice(0, 64) : null;
  const userAgent = (req.headers["user-agent"] as string | undefined)?.slice(0, 500) || null;

  const now = new Date();
  const data: any = {};
  if (terms) {
    data.termsAcceptedAt = now;
    if (termsVersion) data.termsAcceptedVersion = String(termsVersion).slice(0, 64);
    if (ip) data.termsAcceptedIp = ip;
    if (userAgent) data.termsAcceptedUserAgent = userAgent;
  }
  if (rules) {
    data.rulesAcceptedAt = now;
    if (rulesVersion) data.rulesAcceptedVersion = String(rulesVersion).slice(0, 64);
    if (ip) data.rulesAcceptedIp = ip;
    if (userAgent) data.rulesAcceptedUserAgent = userAgent;
  }
  if (contract) {
    data.contractAcceptedAt = now;
    if (contractVersion) data.contractAcceptedVersion = String(contractVersion).slice(0, 64);
    if (ip) data.contractAcceptedIp = ip;
    if (userAgent) data.contractAcceptedUserAgent = userAgent;
  }

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

  // Authorship attestation is mandatory — creator swears they own the content,
  // it was produced legally, and every person depicted is 18+ and consented.
  const attestationAccepted =
    req.body.attestation === true ||
    req.body.attestation === "true" ||
    req.body.attestation === "1";
  if (!attestationAccepted) {
    return res.status(400).json({
      error: "ATTESTATION_REQUIRED",
      message:
        "Debes declarar que eres mayor de edad, dueña del contenido y que todas las personas retratadas son mayores y consintieron.",
    });
  }
  const attestationVersion =
    typeof req.body.attestationVersion === "string"
      ? req.body.attestationVersion.slice(0, 64)
      : null;

  const attestationIpRaw =
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string | undefined) ||
    req.ip ||
    req.socket.remoteAddress ||
    null;
  const attestationIp = attestationIpRaw ? String(attestationIpRaw).slice(0, 64) : null;
  const attestationUserAgent =
    (req.headers["user-agent"] as string | undefined)?.slice(0, 500) || null;

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
    const mediaVis = mediaVisibilities[i] === "PREMIUM" ? "PREMIUM" : "FREE";
    const isPremium = mediaVis === "PREMIUM";
    let savedUrl: string;
    let savedType: "image" | "video";
    if (isPremium) {
      const savedPriv = await savePrivate({
        buffer: files[i].buffer,
        originalName: files[i].originalname,
        mimeType: files[i].mimetype,
        folder: "umate-posts",
      });
      savedUrl = savedPriv.url;
      savedType = savedPriv.type;
    } else {
      const savedPub = await storage.save({
        buffer: files[i].buffer,
        filename: files[i].originalname,
        mimeType: files[i].mimetype,
        folder: "umate-posts",
      });
      savedUrl = savedPub.url;
      savedType = savedPub.type;
    }
    let thumbnailUrl: string | undefined;
    if (savedType === "video") {
      const thumb = await extractVideoThumbnail(files[i].buffer, files[i].originalname, { privateAsset: isPremium });
      if (thumb) thumbnailUrl = thumb;
    }
    mediaItems.push({
      type: savedType === "video" ? "VIDEO" : "IMAGE",
      url: savedUrl,
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
      authorshipAttestedAt: new Date(),
      authorshipAttestedIp: attestationIp,
      authorshipAttestedUserAgent: attestationUserAgent,
      authorshipAttestedVersion: attestationVersion,
      media: { create: mediaItems },
    },
    include: { media: true },
  });

  const updatedCreator = await prisma.umateCreator.update({
    where: { id: creator.id },
    data: { totalPosts: { increment: 1 } },
    select: { totalPosts: true, userId: true },
  });

  // Promotional Gold: first ever Umate post grants 30 days of GOLD tier,
  // unless the user already has PREMIUM or a longer paid membership.
  if (updatedCreator.totalPosts === 1) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: updatedCreator.userId },
        select: { tier: true, membershipExpiresAt: true },
      });
      if (user && user.tier !== "PREMIUM") {
        const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const currentExpiry = user.membershipExpiresAt?.getTime() ?? 0;
        if (currentExpiry <= thirtyDaysOut.getTime()) {
          await prisma.user.update({
            where: { id: updatedCreator.userId },
            data: {
              tier: "GOLD",
              membershipExpiresAt: thirtyDaysOut,
            },
          });
        }
      }
    } catch (err) {
      console.error("[umate/posts] auto-gold grant failed", err);
    }
  }

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

  const postsWithSignedMedia = posts.map((post) => ({
    ...post,
    media: post.media.map((m) => {
      const rewritten = rewritePrivateMediaUrls(m.id, m.url, m.thumbnailUrl);
      return { ...m, url: rewritten.url, thumbnailUrl: rewritten.thumbnailUrl };
    }),
  }));

  res.json({ posts: postsWithSignedMedia });
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
  const viewer = (req as any).user;
  const userId = viewer.id;
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

  // Check access: premium posts require subscription (admins bypass)
  if (post.visibility === "PREMIUM" && !isAdminUser(viewer)) {
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
    select: { id: true, displayName: true, monthlyPriceCLP: true, flowPlanId: true },
  });

  // Sync the creator's Flow plan to the new tariff (fire-and-forget so the UI isn't blocked
  // if Flow is slow; existing subscribers keep their grandfathered price because the Flow
  // subscription was already created against the old planId).
  if (config.flowApiKey) {
    ensureCreatorFlowPlan(updated).catch((err) => {
      console.error("[umate] ensureCreatorFlowPlan after price change failed", { creatorId: creator.id, err: err?.message });
    });
  }

  res.json({ creator: { id: updated.id, monthlyPriceCLP: updated.monthlyPriceCLP } });
}));

/** ── Direct subscription — Step 1: register card with Flow (or skip if already registered) ──
 *
 * If the user already has a registered card (flowCustomerId + flowCardLast4), returns
 * { registered: true } and the frontend can call /confirm immediately.
 *
 * Otherwise creates the Flow customer (if needed), starts a card-registration session,
 * and returns { url } so the frontend can redirect to Flow's hosted card enrollment page.
 *
 * After enrollment, Flow redirects back to:
 *   {appUrl}/umate/subscribe/confirm?c={creatorId}&token={flowRegistrationToken}
 */
umateRouter.post("/umate/creators/:creatorId/subscribe-direct", requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { creatorId } = req.params;

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

  // Already subscribed?
  const existing = await prisma.umateDirectSubscription.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });
  if (existing && existing.status === "ACTIVE" && existing.currentPeriodEnd > new Date()) {
    return res.status(400).json({ error: "ALREADY_SUBSCRIBED", message: "Ya estás suscrito a esta creadora." });
  }

  if (!config.flowApiKey || !config.flowSecretKey) {
    return res.status(503).json({ error: "PAYMENT_UNAVAILABLE", message: "El pago con Flow no está configurado." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, displayName: true, username: true,
      flowCustomerId: true, flowCardLast4: true, flowCardType: true,
    },
  });
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  // If the user already has a card registered with Flow (e.g. because they are also a
  // Uzeed Pro subscriber), we can skip the card-enrollment redirect entirely and go
  // straight to creating the Flow subscription.
  if (user.flowCustomerId && user.flowCardLast4) {
    return res.json({
      registered: true,
      confirmUrl: `${config.appUrl.replace(/\/$/, "")}/umate/subscribe/confirm?c=${creatorId}`,
    });
  }

  const name = (user.displayName || user.username || "").trim();
  const email = (user.email || "").trim().toLowerCase().replace(/\+[^@]*@/, "@");
  if (!email || !name) {
    return res.status(400).json({ error: "MISSING_CUSTOMER_DATA", message: "Se requiere nombre y email para registrar tu tarjeta." });
  }
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    return res.status(400).json({ error: "EMAIL_INVALID", message: "Email inválido." });
  }

  // Ensure Flow customer exists
  let customerId = user.flowCustomerId;
  if (!customerId) {
    try {
      const customer = await createFlowCustomer({ name, email, externalId: userId });
      customerId = customer.customerId;
      await prisma.user.update({ where: { id: userId }, data: { flowCustomerId: customerId } });
    } catch (err: any) {
      console.error("[umate] createFlowCustomer failed", { userId, err: err?.message });
      return res.status(502).json({ error: "FLOW_ERROR", message: "No se pudo iniciar el registro de tarjeta." });
    }
  }

  const appUrl = config.appUrl.replace(/\/$/, "");
  const returnBase = `${appUrl}/umate/subscribe/confirm?c=${encodeURIComponent(creatorId)}`;

  const tryRegister = async (custId: string) => registerFlowCustomer(custId, returnBase);

  let registration;
  try {
    registration = await tryRegister(customerId);
  } catch (err: any) {
    // Stale customerId (7002) — recreate and retry
    if (err?.payload?.code === 7002 || err?.message?.includes("7002") || err?.message?.includes("Customer not found")) {
      console.warn("[umate] stale flowCustomerId, recreating", { userId });
      const customer = await createFlowCustomer({ name, email, externalId: userId });
      customerId = customer.customerId;
      await prisma.user.update({
        where: { id: userId },
        data: { flowCustomerId: customerId, flowCardLast4: null, flowCardType: null },
      });
      registration = await tryRegister(customerId);
    } else {
      console.error("[umate] registerFlowCustomer failed", { userId, err: err?.message });
      return res.status(502).json({ error: "FLOW_ERROR", message: "No se pudo iniciar el registro de tarjeta." });
    }
  }

  console.log("[umate] card registration started", { userId, creatorId, customerId });
  return res.json({
    registered: false,
    url: `${registration.url}?token=${registration.token}`,
    token: registration.token,
  });
}));

/** ── Direct subscription — Step 2: confirm and create Flow subscription ──
 *
 * Called by the /umate/subscribe/confirm return page after the user comes back from
 * Flow's card enrollment. If a `token` is provided, the card registration status is
 * verified against Flow first (and the User's flowCardLast4 is updated).
 *
 * Then a Flow subscription is created against the creator's plan. If Flow reports the
 * subscription as immediately active (status=1), the creator is credited and the
 * UmateDirectSubscription row is activated for a full 30-day period. Otherwise the row
 * is created in a "waiting for webhook" state and activation happens when Flow pings
 * /webhooks/flow/subscription with status=1.
 */
umateRouter.post("/umate/creators/:creatorId/subscribe-direct/confirm", requireAuth, paymentLimiter, asyncHandler(async (req, res) => {
  const userId = (req as any).user.id;
  const { creatorId } = req.params;
  const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";

  const creator = await prisma.umateCreator.findUnique({ where: { id: creatorId } });
  if (!creator || creator.status !== "ACTIVE") {
    return res.status(404).json({ error: "CREATOR_NOT_FOUND" });
  }
  if (creator.userId === userId) {
    return res.status(400).json({ error: "CANNOT_SUBSCRIBE_SELF" });
  }

  // Already subscribed?
  const existing = await prisma.umateDirectSubscription.findUnique({
    where: { userId_creatorId: { userId, creatorId } },
  });
  if (existing && existing.status === "ACTIVE" && existing.currentPeriodEnd > new Date()) {
    return res.status(400).json({ error: "ALREADY_SUBSCRIBED", message: "Ya estás suscrito a esta creadora." });
  }

  if (!config.flowApiKey) {
    return res.status(503).json({ error: "PAYMENT_UNAVAILABLE" });
  }

  // 1) If we got a registration token back from Flow, verify it and snapshot the card
  if (token) {
    try {
      const regStatus = await getFlowRegisterStatus(token);
      const statusNum = Number(regStatus.status);
      if (statusNum !== 1) {
        return res.status(400).json({
          error: "CARD_NOT_REGISTERED",
          message: statusNum === 0 ? "El registro de tarjeta aún está pendiente." : "La tarjeta fue rechazada.",
          status: statusNum,
        });
      }
      if (regStatus.creditCardType || regStatus.last4CardDigits) {
        await prisma.user.update({
          where: { id: userId },
          data: {
            flowCardType: regStatus.creditCardType || null,
            flowCardLast4: regStatus.last4CardDigits || null,
          },
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error("[umate] getFlowRegisterStatus failed", { userId, err: err?.message });
      return res.status(502).json({ error: "FLOW_ERROR", message: "No se pudo verificar el registro de tarjeta." });
    }
  }

  // 2) Load the fresh user (with the up-to-date flow fields)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, flowCustomerId: true, flowCardType: true, flowCardLast4: true },
  });
  if (!user?.flowCustomerId || !user.flowCardLast4) {
    return res.status(400).json({ error: "CARD_NOT_REGISTERED", message: "Primero debes registrar tu tarjeta." });
  }

  // 3) Ensure the creator has an up-to-date Flow plan for her current tariff
  let planId: string;
  try {
    planId = await ensureCreatorFlowPlan(creator);
  } catch (err: any) {
    console.error("[umate] ensureCreatorFlowPlan failed", { creatorId, err: err?.message });
    return res.status(502).json({ error: "FLOW_ERROR", message: "No se pudo preparar el plan de la creadora." });
  }

  // 4) Create the Flow subscription
  let flowSub;
  try {
    flowSub = await createFlowSubscription({ planId, customerId: user.flowCustomerId });
  } catch (err: any) {
    console.error("[umate] createFlowSubscription failed", { userId, creatorId, planId, err: err?.message });
    return res.status(502).json({ error: "FLOW_ERROR", message: "No se pudo crear la suscripción en Flow." });
  }

  // 5) Check Flow subscription status to decide whether to credit immediately
  let flowStatus = 0;
  try {
    const details = await getFlowSubscription(flowSub.subscriptionId);
    flowStatus = Number(details.status);
  } catch { /* webhook will confirm later */ }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const gross = creator.monthlyPriceCLP;
  const activatedNow = flowStatus === 1;

  // Create / update the row
  const record = await prisma.$transaction(async (tx) => {
    const data = {
      priceCLP: gross,
      cardBrand: user.flowCardType || null,
      cardLast4: user.flowCardLast4 || null,
      flowCustomerId: user.flowCustomerId || null,
      flowSubscriptionId: flowSub.subscriptionId,
      status: activatedNow ? "ACTIVE" : "ACTIVE", // waiting-for-webhook is also tracked as ACTIVE
      cancelAtPeriodEnd: false,
      cancelledAt: null,
      startedAt: now,
      currentPeriodStart: now,
      // If Flow hasn't charged yet, we still grant a 30-day period; the webhook will extend
      // it further on the first successful charge. This avoids the edge case where Flow
      // takes a few seconds to mark the subscription as active.
      currentPeriodEnd: periodEnd,
    } as const;

    let row;
    if (existing) {
      row = await tx.umateDirectSubscription.update({ where: { id: existing.id }, data });
    } else {
      row = await tx.umateDirectSubscription.create({ data: { userId, creatorId, ...data } });
      await tx.umateCreator.update({
        where: { id: creatorId },
        data: { subscriberCount: { increment: 1 } },
      });
    }
    return row;
  });

  // 6) If Flow confirms the charge happened, credit the creator now.
  //    Otherwise the webhook will do it when Flow reports status=1.
  if (activatedNow) {
    await creditCreatorForDirectSub({
      creatorId,
      subscriptionId: record.id,
      gross,
      description: `Suscripción directa (PAC) — $${gross.toLocaleString("es-CL")} CLP`,
    });
  }

  // Notify creator
  prisma.notification.create({
    data: {
      userId: creator.userId,
      type: "UMATE_NEW_SUBSCRIBER",
      data: { subscriberId: userId, creatorId, direct: true, flowSubscriptionId: flowSub.subscriptionId },
    },
  }).then(() => {
    sendToUser(creator.userId, "umate:new_subscriber", { creatorId });
  }).catch(() => {});

  res.json({
    subscribed: true,
    activated: activatedNow,
    subscription: {
      id: record.id,
      status: record.status,
      priceCLP: record.priceCLP,
      cardBrand: record.cardBrand,
      cardLast4: record.cardLast4,
      currentPeriodEnd: record.currentPeriodEnd,
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

/** Cancel a direct subscription at period end (access continues until currentPeriodEnd).
 *  Calls Flow to stop future PAC charges; Flow will send a webhook confirming status=3. */
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

  // Tell Flow to stop future charges (at_period_end=true keeps access until cycle end)
  if (sub.flowSubscriptionId && config.flowApiKey) {
    try {
      await cancelFlowSubscription(sub.flowSubscriptionId, true);
    } catch (err: any) {
      console.error("[umate] cancelFlowSubscription failed", { subId: id, flowSubId: sub.flowSubscriptionId, err: err?.message });
      // We still mark the row as cancelled locally so the user sees the change; the worker
      // will retry syncing state with Flow on its next tick.
    }
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

// ══════════════════════════════════════════════════════════════════════
// ADMIN — Demo seed: 10 creadoras de mentira usando perfiles existentes
// ══════════════════════════════════════════════════════════════════════
//
// Totalmente reversible. El manifest con los IDs creados se guarda en
// PlatformConfig (key: umate_demo_seed_manifest). Solo promueve usuarios
// que ya existen a UmateCreator; NO crea usuarios, posts ni suscripciones.
//
// Endpoints:
//   GET  /admin/umate/demo-seed/status   → estado del seed
//   POST /admin/umate/demo-seed          → crear 10 creadoras de demo
//   POST /admin/umate/demo-seed/revert   → borrar sólo las que creó el seed

const DEMO_SEED_KEY = "umate_demo_seed_manifest";
const DEMO_SEED_TARGET_COUNT = 10;
const DEMO_SEED_PRICE_OPTIONS = [2990, 3990, 4990, 5990, 6990, 7990, 9990, 12990, 14990, 19990];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randIntRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

umateRouter.get("/admin/umate/demo-seed/status", requireAdmin, asyncHandler(async (_req, res) => {
  const row = await prisma.platformConfig.findUnique({ where: { key: DEMO_SEED_KEY } });
  if (!row) return res.json({ seeded: false });
  try {
    const manifest = JSON.parse(row.value);
    const creators = Array.isArray(manifest?.creators) ? manifest.creators : [];
    // Sanity check: confirm the creators still exist in DB
    const ids = creators.map((c: any) => c.id).filter(Boolean);
    const alive = ids.length > 0
      ? await prisma.umateCreator.count({ where: { id: { in: ids } } })
      : 0;
    return res.json({
      seeded: true,
      count: creators.length,
      alive,
      createdAt: manifest.createdAt,
      creators: creators.map((c: any) => ({
        id: c.id,
        username: c.username,
        displayName: c.displayName,
        monthlyPriceCLP: c.monthlyPriceCLP,
      })),
    });
  } catch {
    return res.json({ seeded: false });
  }
}));

umateRouter.post("/admin/umate/demo-seed", requireAdmin, asyncHandler(async (_req, res) => {
  // Guard: only one active seed at a time
  const existing = await prisma.platformConfig.findUnique({ where: { key: DEMO_SEED_KEY } });
  if (existing) {
    return res.status(400).json({
      error: "ALREADY_SEEDED",
      message: "Ya hay un seed demo activo. Revértelo primero antes de crear uno nuevo.",
    });
  }

  // Buscar candidatos — activos, con avatar, sin UmateCreator previo.
  // Orden de preferencia igual al script JS:
  //   1º: PROFESSIONAL con bio + cover
  //   2º: PROFESSIONAL con bio (sin cover)
  //   3º: cualquier usuario activo con avatar
  const baseWhere: any = {
    isActive: true,
    avatarUrl: { not: null },
    umateCreator: null,
  };

  const candidates: Array<{
    id: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
  }> = [];

  const lvl1 = await prisma.user.findMany({
    where: {
      ...baseWhere,
      profileType: "PROFESSIONAL",
      bio: { not: null },
      coverUrl: { not: null },
    },
    select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
    take: DEMO_SEED_TARGET_COUNT,
    orderBy: { createdAt: "desc" },
  });
  candidates.push(...lvl1);

  if (candidates.length < DEMO_SEED_TARGET_COUNT) {
    const already = new Set(candidates.map((c) => c.id));
    const lvl2 = await prisma.user.findMany({
      where: {
        ...baseWhere,
        profileType: "PROFESSIONAL",
        bio: { not: null },
        id: { notIn: Array.from(already) },
      },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
      take: DEMO_SEED_TARGET_COUNT - candidates.length,
      orderBy: { createdAt: "desc" },
    });
    candidates.push(...lvl2);
  }

  if (candidates.length < DEMO_SEED_TARGET_COUNT) {
    const already = new Set(candidates.map((c) => c.id));
    const lvl3 = await prisma.user.findMany({
      where: {
        ...baseWhere,
        id: { notIn: Array.from(already) },
      },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
      take: DEMO_SEED_TARGET_COUNT - candidates.length,
      orderBy: { createdAt: "desc" },
    });
    candidates.push(...lvl3);
  }

  if (candidates.length === 0) {
    return res.status(400).json({
      error: "NO_CANDIDATES",
      message: "No se encontraron usuarios elegibles (activos, con avatar, sin UmateCreator previo).",
    });
  }

  const now = new Date();
  const created: Array<{
    id: string;
    userId: string;
    username: string;
    displayName: string;
    monthlyPriceCLP: number;
  }> = [];

  for (const user of candidates) {
    try {
      const creator = await prisma.umateCreator.create({
        data: {
          userId: user.id,
          displayName: user.displayName || user.username || "Creadora",
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          coverUrl: user.coverUrl,
          monthlyPriceCLP: pickRandom(DEMO_SEED_PRICE_OPTIONS),
          status: "ACTIVE",
          termsAcceptedAt: now,
          rulesAcceptedAt: now,
          contractAcceptedAt: now,
          subscriberCount: randIntRange(0, 250),
          totalPosts: 0,
          totalLikes: 0,
        },
        select: { id: true, displayName: true, monthlyPriceCLP: true },
      });

      created.push({
        id: creator.id,
        userId: user.id,
        username: user.username,
        displayName: creator.displayName,
        monthlyPriceCLP: creator.monthlyPriceCLP,
      });
    } catch (err: any) {
      console.warn("[umate demo-seed] error creando creator", { userId: user.id, err: err?.message });
    }
  }

  if (created.length === 0) {
    return res.status(500).json({ error: "SEED_FAILED", message: "No se pudo crear ningún creator." });
  }

  // Guardar manifest en PlatformConfig
  const manifest = {
    createdAt: now.toISOString(),
    count: created.length,
    creators: created,
  };

  await prisma.platformConfig.create({
    data: { key: DEMO_SEED_KEY, value: JSON.stringify(manifest) },
  });

  res.json({ seeded: true, count: created.length, creators: created });
}));

umateRouter.post("/admin/umate/demo-seed/revert", requireAdmin, asyncHandler(async (_req, res) => {
  const row = await prisma.platformConfig.findUnique({ where: { key: DEMO_SEED_KEY } });
  if (!row) {
    return res.json({ reverted: true, count: 0, message: "No había seed demo activo." });
  }

  let manifest: any;
  try {
    manifest = JSON.parse(row.value);
  } catch {
    // Manifest corrupto — simplemente bórralo
    await prisma.platformConfig.delete({ where: { key: DEMO_SEED_KEY } });
    return res.json({ reverted: true, count: 0, message: "Manifest corrupto; eliminado." });
  }

  const ids: string[] = Array.isArray(manifest?.creators)
    ? manifest.creators.map((c: any) => c.id).filter(Boolean)
    : [];

  let deleted = 0;
  if (ids.length > 0) {
    // Cascade en Prisma borra UmatePost, UmatePostMedia, UmateCreatorSub,
    // UmateDirectSubscription y UmateLedgerEntry (creatorId SetNull) asociados.
    const result = await prisma.umateCreator.deleteMany({ where: { id: { in: ids } } });
    deleted = result.count;
  }

  await prisma.platformConfig.delete({ where: { key: DEMO_SEED_KEY } });

  res.json({ reverted: true, count: deleted });
}));

// ══════════════════════════════════════════════════════════════════════
// ADMIN — Umate promotional campaign (invitation blast to professionals)
// ══════════════════════════════════════════════════════════════════════

const UMATE_PROMO_LOG_TYPE = "umate_promo_v1";

umateRouter.post(
  "/admin/umate/promotional-campaign/send",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const testEmail = typeof req.body.testEmail === "string" ? req.body.testEmail : undefined;
    const batchSize = Math.min(200, Number(req.body.batchSize) || 50);

    if (testEmail) {
      await sendUmatePromotionalEmail(testEmail, {
        displayName: "Test Creator",
        hasUmateAccount: false,
      });
      return res.json({ ok: true, mode: "test", sentTo: testEmail });
    }

    const users = await prisma.user.findMany({
      where: {
        profileType: "PROFESSIONAL",
        isActive: true,
        email: { not: "" },
        OR: [
          { umateCreator: null },
          { umateCreator: { status: { not: "ACTIVE" } } },
        ],
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        umateCreator: { select: { status: true } },
      },
      take: batchSize,
    });

    const userIds = users.map((u) => u.id);
    const alreadySent = await prisma.reminderLog.findMany({
      where: { userId: { in: userIds }, type: UMATE_PROMO_LOG_TYPE },
      select: { userId: true },
    });
    const sentSet = new Set(alreadySent.map((r) => r.userId));
    const toSend = users.filter((u) => !sentSet.has(u.id));

    let sentCount = 0;
    let errorCount = 0;

    for (const user of toSend) {
      try {
        await prisma.reminderLog.upsert({
          where: { userId_type: { userId: user.id, type: UMATE_PROMO_LOG_TYPE } },
          update: { createdAt: new Date() },
          create: { userId: user.id, type: UMATE_PROMO_LOG_TYPE },
        });

        await sendUmatePromotionalEmail(user.email, {
          displayName: user.displayName,
          hasUmateAccount: Boolean(user.umateCreator),
        });
        sentCount++;
      } catch (err) {
        console.error("[admin/umate-promo] failed", user.email, err);
        errorCount++;
      }
    }

    return res.json({
      ok: true,
      mode: "campaign",
      batchFetched: users.length,
      sent: sentCount,
      errors: errorCount,
      alreadySent: sentSet.size,
      remainingInBatch: users.length - toSend.length,
    });
  }),
);

umateRouter.get(
  "/admin/umate/promotional-campaign/status",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const [totalEligible, totalSent] = await Promise.all([
      prisma.user.count({
        where: {
          profileType: "PROFESSIONAL",
          isActive: true,
          email: { not: "" },
          OR: [
            { umateCreator: null },
            { umateCreator: { status: { not: "ACTIVE" } } },
          ],
        },
      }),
      prisma.reminderLog.count({ where: { type: UMATE_PROMO_LOG_TYPE } }),
    ]);
    res.json({
      totalEligible,
      totalSent,
      remaining: Math.max(0, totalEligible - totalSent),
    });
  }),
);
