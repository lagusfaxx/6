import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { env } from "../lib/env";
import path from "node:path";

export const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const storage = new LocalStorageProvider(path.join(process.cwd(), env.UPLOADS_DIR), `${env.API_BASE_URL}/uploads`);

adminRouter.get("/admin/posts", requireAdmin, async (req, res) => {
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, include: { media: true } });
  res.json({ posts });
});

adminRouter.post("/admin/posts", requireAdmin, upload.array("files", 10), async (req, res) => {
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
});

adminRouter.put("/admin/posts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, body, isPublic } = req.body as { title?: string; body?: string; isPublic?: boolean };
  const updated = await prisma.post.update({ where: { id }, data: { title, body, isPublic } });
  res.json({ post: updated });
});

adminRouter.post("/admin/posts/:id/media", requireAdmin, upload.array("files", 10), async (req, res) => {
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
});

// ----------------------------
// BANNERS (Home Ads)
// ----------------------------
adminRouter.get("/admin/banners", requireAdmin, async (_req, res) => {
  const banners = await prisma.banner.findMany({ orderBy: [{ position: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }] });
  res.json({ banners });
});

adminRouter.post("/admin/banners", requireAdmin, async (req, res) => {
  const { title, imageUrl, linkUrl, position, isActive, sortOrder } = req.body ?? {};
  if (!title || !imageUrl) return res.status(400).json({ error: "VALIDATION", message: "title and imageUrl required" });
  const banner = await prisma.banner.create({
    data: {
      title: String(title),
      imageUrl: String(imageUrl),
      linkUrl: linkUrl ? String(linkUrl) : null,
      position: position ? String(position) : "RIGHT",
      isActive: typeof isActive === "boolean" ? isActive : true,
      sortOrder: typeof sortOrder === "number" ? sortOrder : parseInt(String(sortOrder ?? "0"), 10) || 0
    }
  });
  res.json({ banner });
});

adminRouter.put("/admin/banners/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { title, imageUrl, linkUrl, position, isActive, sortOrder } = req.body ?? {};
  const banner = await prisma.banner.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title: String(title) } : {}),
      ...(imageUrl !== undefined ? { imageUrl: String(imageUrl) } : {}),
      ...(linkUrl !== undefined ? { linkUrl: linkUrl ? String(linkUrl) : null } : {}),
      ...(position !== undefined ? { position: String(position) } : {}),
      ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: typeof sortOrder === "number" ? sortOrder : parseInt(String(sortOrder), 10) || 0 } : {})
    }
  });
  res.json({ banner });
});

adminRouter.delete("/admin/banners/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  await prisma.banner.delete({ where: { id } });
  res.json({ ok: true });
});

adminRouter.post("/admin/banners/upload", requireAdmin, upload.single("file"), async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "VALIDATION", message: "file required" });
  const result = await storage.save(file);
  res.json({ url: result.url });
});

// ----------------------------
// PROFILES (Admin Management)
// ----------------------------

// List all profiles with filtering
adminRouter.get("/admin/profiles", requireAdmin, async (req, res) => {
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
});

// Toggle profile active status
adminRouter.put("/admin/profiles/:id/toggle", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  const updated = await prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: { id: true, username: true, isActive: true },
  });
  res.json({ profile: updated });
});

// Update profile fields (admin override)
adminRouter.put("/admin/profiles/:id", requireAdmin, async (req, res) => {
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
});

// Delete profile permanently
adminRouter.delete("/admin/profiles/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });

  // Delete in proper order to handle foreign key constraints
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.story.deleteMany({ where: { userId: id } });
    await tx.pushSubscription.deleteMany({ where: { userId: id } });
    await tx.favorite.deleteMany({ where: { OR: [{ userId: id }, { professionalId: id }] } });
    await tx.profileMedia.deleteMany({ where: { userId: id } });
    await tx.serviceItem.deleteMany({ where: { userId: id } });
    await tx.message.deleteMany({ where: { OR: [{ senderId: id }, { receiverId: id }] } });
    await tx.user.delete({ where: { id } });
  });

  res.json({ ok: true });
});

