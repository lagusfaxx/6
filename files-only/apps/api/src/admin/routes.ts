import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { CreatePostSchema } from "@uzeed/shared";
import multer from "multer";
import path from "path";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { asyncHandler } from "../lib/asyncHandler";

export const adminRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`,
});

const mediaFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    return cb(new Error("INVALID_FILE_TYPE"));
  }
  return cb(null, true);
};

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const name = `${Date.now()}-${safeBase}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: mediaFilter,
});

adminRouter.use(requireAdmin);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [users, posts, payments] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.payment.count(),
    ]);
    return res.json({ users, posts, payments });
  }),
);

adminRouter.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: { media: true },
    });
    return res.json({
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        media: p.media.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      })),
    });
  }),
);

adminRouter.post(
  "/posts",
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const { title, body, isPublic, price } = req.body as Record<string, string>;
    const payload = {
      title,
      body,
      isPublic: isPublic === "true",
      price: price ? Number(price) : 0,
    };
    const parsed = CreatePostSchema.safeParse(payload);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });

    const post = await prisma.post.create({
      data: {
        authorId: req.session.userId!,
        title: parsed.data.title,
        body: parsed.data.body,
        isPublic: parsed.data.isPublic,
        price: parsed.data.price,
      },
    });

    const files = (req.files as Express.Multer.File[]) ?? [];
    const media = [];
    for (const file of files) {
      const mime = (file.mimetype || "").toLowerCase();
      const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
      const url = storageProvider.publicUrl(file.filename);
      media.push(
        await prisma.media.create({ data: { postId: post.id, type, url } }),
      );
    }
    const hasVideo = media.some((m) => m.type === "VIDEO");
    if (hasVideo) {
      await prisma.post.update({
        where: { id: post.id },
        data: { type: "VIDEO" },
      });
    }

    return res.json({ post: { ...post, media } });
  }),
);

adminRouter.put(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const parsed = CreatePostSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    return res.json({ post });
  }),
);

adminRouter.delete(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    await prisma.post.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  }),
);

adminRouter.post(
  "/posts/:id/media",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });
    const mime = (req.file.mimetype || "").toLowerCase();
    const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
    const url = storageProvider.publicUrl(req.file.filename);

    const media = await prisma.media.create({
      data: { postId: req.params.id, type, url },
    });
    if (type === "VIDEO") {
      await prisma.post.update({
        where: { id: req.params.id },
        data: { type: "VIDEO" },
      });
    }

    return res.json({ media });
  }),
);

// New admin endpoints for moderation, ads, metrics, reviews, terms
adminRouter.get(
  "/profiles",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(10, Number(req.query.limit || 20)));
    const status = typeof req.query.status === "string" ? req.query.status : "";

    const where: any = {
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
      ...(status &&
      ["PENDING_REVIEW", "APPROVED", "REJECTED", "BANNED"].includes(status)
        ? { moderationStatus: status }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          profileType: true,
          moderationStatus: true,
          moderationReason: true,
          isActive: true,
          createdAt: true,
          planTier: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({ items, total, page, limit });
  }),
);

adminRouter.patch(
  "/profiles/:id/moderation",
  asyncHandler(async (req, res) => {
    const { status, reason, isActive } = req.body as {
      status?: string;
      reason?: string;
      isActive?: boolean;
    };
    const data: any = {};
    if (
      status &&
      ["PENDING_REVIEW", "APPROVED", "REJECTED", "BANNED"].includes(status)
    )
      data.moderationStatus = status;
    if (reason !== undefined) data.moderationReason = reason || null;
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ user });
  }),
);

adminRouter.get(
  "/ads",
  asyncHandler(async (_req, res) => {
    const ads = await prisma.ad.findMany({
      orderBy: [{ placement: "asc" }, { order: "asc" }, { createdAt: "desc" }],
    });
    res.json({ ads });
  }),
);

adminRouter.post(
  "/ads",
  asyncHandler(async (req, res) => {
    const { placement, imageUrl, linkUrl, isActive, order, startAt, endAt } =
      req.body ?? {};
    if (!placement || !imageUrl)
      return res.status(400).json({ error: "VALIDATION" });
    const ad = await prisma.ad.create({
      data: {
        placement,
        imageUrl,
        linkUrl: linkUrl || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        order: Number.isFinite(Number(order)) ? Number(order) : 0,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });
    res.json({ ad });
  }),
);

adminRouter.patch(
  "/ads/:id",
  asyncHandler(async (req, res) => {
    const { placement, imageUrl, linkUrl, isActive, order, startAt, endAt } =
      req.body ?? {};
    const ad = await prisma.ad.update({
      where: { id: req.params.id },
      data: {
        ...(placement !== undefined ? { placement } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(linkUrl !== undefined ? { linkUrl: linkUrl || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(order !== undefined ? { order: Number(order) || 0 } : {}),
        ...(startAt !== undefined
          ? { startAt: startAt ? new Date(startAt) : null }
          : {}),
        ...(endAt !== undefined
          ? { endAt: endAt ? new Date(endAt) : null }
          : {}),
      },
    });
    res.json({ ad });
  }),
);

adminRouter.delete(
  "/ads/:id",
  asyncHandler(async (req, res) => {
    await prisma.ad.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  }),
);

adminRouter.get(
  "/metrics",
  asyncHandler(async (_req, res) => {
    const [users, approvedProfiles, pendingProfiles, messages, storyViews] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({
          where: {
            moderationStatus: "APPROVED",
            profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
          },
        }),
        prisma.user.count({
          where: {
            moderationStatus: "PENDING_REVIEW",
            profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
          },
        }),
        prisma.message.count(),
        prisma.storyView.count(),
      ]);

    const topProfiles = await prisma.user.findMany({
      where: { profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] } },
      orderBy: [{ profileViews: "desc" }, { completedServices: "desc" }],
      take: 10,
      select: {
        id: true,
        username: true,
        displayName: true,
        profileViews: true,
        completedServices: true,
      },
    });

    res.json({
      users,
      approvedProfiles,
      pendingProfiles,
      messages,
      storyViews,
      topProfiles,
    });
  }),
);

adminRouter.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(10, Number(req.query.limit || 20)));
    const reviews = await prisma.review.findMany({
      include: {
        author: { select: { id: true, username: true, displayName: true } },
        profile: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    res.json({ reviews, page, limit });
  }),
);

adminRouter.patch(
  "/reviews/:id",
  asyncHandler(async (req, res) => {
    const { status } = req.body as { status?: string };
    if (!status || !["VISIBLE", "HIDDEN"].includes(status))
      return res.status(400).json({ error: "VALIDATION" });
    const review = await prisma.review.update({
      where: { id: req.params.id },
      data: { status: status as any },
    });
    res.json({ review });
  }),
);

adminRouter.get(
  "/terms",
  asyncHandler(async (_req, res) => {
    const terms = await prisma.termsVersion.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ terms });
  }),
);

adminRouter.post(
  "/terms",
  asyncHandler(async (req, res) => {
    const { version, pdfUrl, contentUrl, isActive } = req.body as {
      version?: string;
      pdfUrl?: string;
      contentUrl?: string;
      isActive?: boolean;
    };
    if (!version) return res.status(400).json({ error: "VALIDATION" });
    if (isActive)
      await prisma.termsVersion.updateMany({ data: { isActive: false } });
    const term = await prisma.termsVersion.create({
      data: {
        version,
        pdfUrl: pdfUrl || null,
        contentUrl: contentUrl || null,
        isActive: Boolean(isActive),
      },
    });
    res.json({ term });
  }),
);

adminRouter.patch(
  "/terms/:id",
  asyncHandler(async (req, res) => {
    const { pdfUrl, contentUrl, isActive } = req.body as {
      pdfUrl?: string;
      contentUrl?: string;
      isActive?: boolean;
    };
    if (isActive)
      await prisma.termsVersion.updateMany({ data: { isActive: false } });
    const term = await prisma.termsVersion.update({
      where: { id: req.params.id },
      data: {
        ...(pdfUrl !== undefined ? { pdfUrl: pdfUrl || null } : {}),
        ...(contentUrl !== undefined ? { contentUrl: contentUrl || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    });
    res.json({ term });
  }),
);
