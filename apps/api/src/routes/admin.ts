import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { env } from "../lib/env";
import path from "node:path";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";

export const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const storage = new LocalStorageProvider(path.resolve(env.UPLOADS_DIR), "/uploads");

adminRouter.get("/admin/posts", requireAdmin, asyncHandler(async (req, res) => {
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, include: { media: true } });
  res.json({ posts });
}));

adminRouter.post("/admin/posts", requireAdmin, upload.array("files", 10), asyncHandler(async (req, res) => {
  const { title, body, isPublic } = req.body as Record<string, string>;
  if (!title || !body) return res.status(400).json({ error: "BAD_REQUEST" });
  const authorId = req.session.userId!;
  const created = await prisma.post.create({
    data: {
      title,
      body,
      isPublic: isPublic === "true",
      authorId
    }
  });

  const files = (req.files as Express.Multer.File[]) ?? [];
  const media = [] as any[];
  for (const f of files) {
    const folder = created.id;
    const mime = f.mimetype;
    const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
    const stored = await storage.save({ buffer: f.buffer, filename: f.originalname, mimeType: mime, folder });
    const m = await prisma.media.create({ data: { postId: created.id, type, url: stored.url } });
    media.push(m);
  }

  res.json({ post: { ...created, media } });
}));

adminRouter.put("/admin/posts/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, body, isPublic } = req.body as { title?: string; body?: string; isPublic?: boolean };
  const updated = await prisma.post.update({ where: { id }, data: { title, body, isPublic } });
  res.json({ post: updated });
}));

adminRouter.post("/admin/posts/:id/media", requireAdmin, upload.array("files", 10), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const exists = await prisma.post.findUnique({ where: { id } });
  if (!exists) return res.status(404).json({ error: "NOT_FOUND" });
  const files = (req.files as Express.Multer.File[]) ?? [];
  const created = [];
  for (const f of files) {
    const folder = id;
    const mime = f.mimetype;
    const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
    const stored = await storage.save({ buffer: f.buffer, filename: f.originalname, mimeType: mime, folder });
    const m = await prisma.media.create({ data: { postId: id, type, url: stored.url } });
    created.push(m);
  }
  res.json({ media: created });
}));

// ----------------------------
// BANNERS (Home Ads)
// ----------------------------
adminRouter.get("/admin/banners", requireAdmin, asyncHandler(async (_req, res) => {
  const banners = await prisma.banner.findMany({ orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
  res.json({ banners });
}));

adminRouter.post("/admin/banners", requireAdmin, asyncHandler(async (req, res) => {
  const { title, imageUrl, linkUrl, position, isActive, sortOrder, adTier, imageFocusX, imageFocusY, imageZoom } = req.body ?? {};
  if (!title || !imageUrl) return res.status(400).json({ error: "VALIDATION", message: "title and imageUrl required" });
  const banner = await prisma.banner.create({
    data: {
      title: String(title),
      imageUrl: String(imageUrl),
      linkUrl: linkUrl ? String(linkUrl) : null,
      position: position ? String(position) : "RIGHT",
      isActive: typeof isActive === "boolean" ? isActive : true,
      sortOrder: typeof sortOrder === "number" ? sortOrder : parseInt(String(sortOrder ?? "0"), 10) || 0,
      adTier: String(adTier || "STANDARD").toUpperCase() === "GOLD" ? "GOLD" : "STANDARD",
      imageFocusX: typeof imageFocusX === "number" ? Math.max(0, Math.min(100, imageFocusX)) : 50,
      imageFocusY: typeof imageFocusY === "number" ? Math.max(0, Math.min(100, imageFocusY)) : 20,
      imageZoom: typeof imageZoom === "number" ? Math.max(1, Math.min(3, imageZoom)) : 1,
    }
  });
  res.json({ banner });
}));

adminRouter.put("/admin/banners/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, imageUrl, linkUrl, position, isActive, sortOrder, adTier, imageFocusX, imageFocusY, imageZoom } = req.body ?? {};
  const banner = await prisma.banner.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(imageUrl !== undefined ? { imageUrl: String(imageUrl) } : {}),
      ...(linkUrl !== undefined ? { linkUrl: linkUrl ? String(linkUrl) : null } : {}),
      ...(position !== undefined ? { position: String(position) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: typeof sortOrder === "number" ? sortOrder : parseInt(String(sortOrder), 10) || 0 } : {}),
      ...(adTier !== undefined ? { adTier: String(adTier).toUpperCase() === "GOLD" ? "GOLD" : "STANDARD" } : {}),
      ...(imageFocusX !== undefined ? { imageFocusX: Math.max(0, Math.min(100, Number(imageFocusX) || 50)) } : {}),
      ...(imageFocusY !== undefined ? { imageFocusY: Math.max(0, Math.min(100, Number(imageFocusY) || 20)) } : {}),
      ...(imageZoom !== undefined ? { imageZoom: Math.max(1, Math.min(3, Number(imageZoom) || 1)) } : {}),
    }
  });
  res.json({ banner });
}));

adminRouter.delete("/admin/banners/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.banner.delete({ where: { id } });
  res.json({ ok: true });
}));

adminRouter.post("/admin/banners/upload", requireAdmin, upload.single("file"), asyncHandler(async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "VALIDATION", message: "file required" });
  const result = await storage.save(file);
  res.json({ url: result.url });
}));

// ----------------------------
// PROFILES (Admin Management)
// ----------------------------

// List all profiles with filtering
adminRouter.get("/admin/profiles", requireAdmin, asyncHandler(async (req, res) => {
  const { profileType, isActive, q, limit, offset } = req.query as Record<string, string | undefined>;
  const take = Math.min(parseInt(limit || "50", 10) || 50, 200);
  const skip = parseInt(offset || "0", 10) || 0;

  const where: any = {};
  if (profileType) where.profileType = profileType;
  if (isActive !== undefined) where.isActive = isActive === "true";
  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [profiles, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        profileType: true,
        isActive: true,
        isOnline: true,
        lastSeen: true,
        city: true,
        tier: true,
        role: true,
        membershipExpiresAt: true,
        completedServices: true,
        profileViews: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ profiles, total });
}));


adminRouter.get("/admin/profiles/:id/media-videos", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const media = await prisma.profileMedia.findMany({
    where: { ownerId: id, type: "VIDEO" },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, type: true, createdAt: true },
  });
  res.json({ media });
}));

// Toggle profile active status
adminRouter.put("/admin/profiles/:id/toggle", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: { id: true, username: true, isActive: true },
  });
  res.json({ profile: updated });
}));

// Update profile fields (admin override)
adminRouter.put("/admin/profiles/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive, tier, role, membershipExpiresAt } = req.body ?? {};

  const data: any = {};
  if (isActive !== undefined) data.isActive = Boolean(isActive);
  if (tier !== undefined) data.tier = tier;
  if (role !== undefined) data.role = role;
  if (membershipExpiresAt !== undefined) {
    data.membershipExpiresAt = membershipExpiresAt ? new Date(membershipExpiresAt) : null;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      isActive: true,
      tier: true,
      role: true,
      membershipExpiresAt: true,
    },
  });
  res.json({ profile: updated });
}));

// ----------------------------
// TRIALS / SUBSCRIPTIONS (Admin Management)
// ----------------------------

const BUSINESS_TYPES = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// List business profiles by trial / payment status
adminRouter.get("/admin/trials", requireAdmin, asyncHandler(async (req, res) => {
  const { status, q, profileType, limit, offset } = req.query as Record<string, string | undefined>;
  const take = Math.min(parseInt(limit || "50", 10) || 50, 200);
  const skip = parseInt(offset || "0", 10) || 0;
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - config.freeTrialDays * DAY_MS);

  const where: any = {
    profileType: profileType && (BUSINESS_TYPES as readonly string[]).includes(profileType)
      ? profileType
      : { in: BUSINESS_TYPES as unknown as string[] },
  };

  if (q) {
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    // Trial active (explicit shopTrialEndsAt OR within grace window) AND no active paid membership
    where.AND = [
      { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
      {
        OR: [
          { shopTrialEndsAt: { gt: now } },
          {
            AND: [
              { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
              { createdAt: { gt: graceCutoff } },
            ],
          },
        ],
      },
    ];
  } else if (status === "expired") {
    // Trial expired AND no paid membership = deactivated by non-payment
    where.AND = [
      { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
      { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
      { createdAt: { lte: graceCutoff } },
    ];
  } else if (status === "paid") {
    where.AND = [{ membershipExpiresAt: { gt: now } }];
  }

  const [profiles, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        profileType: true,
        isActive: true,
        isOnline: true,
        lastSeen: true,
        city: true,
        tier: true,
        role: true,
        shopTrialEndsAt: true,
        membershipExpiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ shopTrialEndsAt: "asc" }, { createdAt: "desc" }],
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ]);

  const augmented = profiles.map((p) => {
    const effectiveTrialEnd = p.shopTrialEndsAt
      ? p.shopTrialEndsAt
      : new Date(p.createdAt.getTime() + config.freeTrialDays * DAY_MS);
    const trialActive = effectiveTrialEnd.getTime() > now.getTime();
    const membershipActive = p.membershipExpiresAt ? p.membershipExpiresAt.getTime() > now.getTime() : false;
    const planActive = trialActive || membershipActive;
    const trialMsRemaining = effectiveTrialEnd.getTime() - now.getTime();
    const trialDaysRemaining = trialActive ? Math.max(0, Math.ceil(trialMsRemaining / DAY_MS)) : 0;
    const trialHoursRemaining = trialActive ? Math.max(0, Math.floor(trialMsRemaining / (60 * 60 * 1000))) : 0;
    const membershipDaysRemaining = membershipActive && p.membershipExpiresAt
      ? Math.max(0, Math.ceil((p.membershipExpiresAt.getTime() - now.getTime()) / DAY_MS))
      : 0;

    return {
      ...p,
      shopTrialEndsAt: p.shopTrialEndsAt?.toISOString() || null,
      effectiveTrialEndsAt: effectiveTrialEnd.toISOString(),
      membershipExpiresAt: p.membershipExpiresAt?.toISOString() || null,
      trialActive,
      membershipActive,
      planActive,
      trialDaysRemaining,
      trialHoursRemaining,
      trialMsRemaining: trialActive ? trialMsRemaining : 0,
      membershipDaysRemaining,
      deactivatedByNonPayment: !planActive,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      lastSeen: p.lastSeen?.toISOString() || null,
    };
  });

  res.json({
    profiles: augmented,
    total,
    freeTrialDays: config.freeTrialDays,
    membershipDays: config.membershipDays,
  });
}));

// Counters for the trials dashboard tabs
adminRouter.get("/admin/trials/counts", requireAdmin, asyncHandler(async (_req, res) => {
  const now = new Date();
  const graceCutoff = new Date(now.getTime() - config.freeTrialDays * DAY_MS);
  const businessFilter = { profileType: { in: BUSINESS_TYPES as unknown as string[] } };

  const [active, expired, paid] = await Promise.all([
    prisma.user.count({
      where: {
        ...businessFilter,
        AND: [
          { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
          {
            OR: [
              { shopTrialEndsAt: { gt: now } },
              {
                AND: [
                  { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
                  { createdAt: { gt: graceCutoff } },
                ],
              },
            ],
          },
        ],
      },
    }),
    prisma.user.count({
      where: {
        ...businessFilter,
        AND: [
          { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
          { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
          { createdAt: { lte: graceCutoff } },
        ],
      },
    }),
    prisma.user.count({
      where: { ...businessFilter, membershipExpiresAt: { gt: now } },
    }),
  ]);

  res.json({ active, expired, paid, freeTrialDays: config.freeTrialDays });
}));

// Manage trial / membership for a profile (manual activation / extension)
adminRouter.put("/admin/profiles/:id/trial", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { trialEndsAt, membershipExpiresAt, addTrialDays, addMembershipDays, isActive } = req.body ?? {};

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, shopTrialEndsAt: true, membershipExpiresAt: true, isActive: true, profileType: true },
  });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  const now = new Date();
  const data: any = {};

  if (trialEndsAt !== undefined) {
    data.shopTrialEndsAt = trialEndsAt ? new Date(trialEndsAt) : null;
  } else if (typeof addTrialDays === "number" && Number.isFinite(addTrialDays) && addTrialDays !== 0) {
    const base = user.shopTrialEndsAt && user.shopTrialEndsAt.getTime() > now.getTime() ? user.shopTrialEndsAt : now;
    data.shopTrialEndsAt = new Date(base.getTime() + addTrialDays * DAY_MS);
  }

  if (membershipExpiresAt !== undefined) {
    data.membershipExpiresAt = membershipExpiresAt ? new Date(membershipExpiresAt) : null;
  } else if (typeof addMembershipDays === "number" && Number.isFinite(addMembershipDays) && addMembershipDays !== 0) {
    const base = user.membershipExpiresAt && user.membershipExpiresAt.getTime() > now.getTime()
      ? user.membershipExpiresAt
      : now;
    data.membershipExpiresAt = new Date(base.getTime() + addMembershipDays * DAY_MS);
  }

  if (isActive !== undefined) data.isActive = Boolean(isActive);

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "VALIDATION", message: "No changes provided" });
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      displayName: true,
      isActive: true,
      profileType: true,
      shopTrialEndsAt: true,
      membershipExpiresAt: true,
    },
  });

  res.json({
    profile: {
      ...updated,
      shopTrialEndsAt: updated.shopTrialEndsAt?.toISOString() || null,
      membershipExpiresAt: updated.membershipExpiresAt?.toISOString() || null,
    },
  });
}));

// Delete profile permanently
adminRouter.delete("/admin/profiles/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  // Delete in proper order to handle foreign key constraints
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.story.deleteMany({ where: { userId: id } });
    await tx.pushSubscription.deleteMany({ where: { userId: id } });
    await tx.favorite.deleteMany({ where: { OR: [{ userId: id }, { professionalId: id }] } });
    await tx.profileMedia.deleteMany({ where: { ownerId: id } });
    await tx.serviceItem.deleteMany({ where: { ownerId: id } });
    await tx.message.deleteMany({ where: { OR: [{ fromId: id }, { toId: id }] } });
    await tx.user.delete({ where: { id } });
  });

  res.json({ ok: true });
}));
