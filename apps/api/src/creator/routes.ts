import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { CreatePostSchema } from "@uzeed/shared";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { validateUploadedFile } from "../lib/uploads";
import { asyncHandler } from "../lib/asyncHandler";

export const creatorRouter = Router();
creatorRouter.use(requireAuth);

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`
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
      const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
      const name = `${Date.now()}-${safeBase}${ext}`;
      cb(null, name);
    }
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: mediaFilter
});

async function ensureCreator(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  // MVP behaviour: allow any authenticated user to publish (IG-like).
  // Some older DBs may have profileType=PERSON (legacy) or VIEWER.
  if (!user || !["CREATOR", "PROFESSIONAL", "SHOP", "VIEWER", "PERSON"].includes(user.profileType)) {
    return false;
  }
  return true;
}

async function listMyPosts(userId: string) {
  return prisma.post.findMany({
    where: { authorId: userId },
    orderBy: { createdAt: "desc" },
    include: { media: true }
  });
}

creatorRouter.get("/posts/mine", asyncHandler(async (req, res) => {
  const posts = await listMyPosts(req.session.userId!);
  return res.json({ posts });
}));

creatorRouter.get("/creator/posts", asyncHandler(async (req, res) => {
  const posts = await listMyPosts(req.session.userId!);
  return res.json({ posts });
}));

creatorRouter.post("/posts/mine", upload.array("files", 10), asyncHandler(async (req, res) => {
  const ok = await ensureCreator(req.session.userId!);
  if (!ok) return res.status(403).json({ error: "FORBIDDEN" });

  const { title, body, isPublic, price } = req.body as Record<string, string>;
  const payload = {
    title,
    body,
    isPublic: isPublic === "true",
    price: price ? Number(price) : 0
  };
  const parsed = CreatePostSchema.safeParse(payload);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const post = await prisma.post.create({
    data: {
      authorId: req.session.userId!,
      title: parsed.data.title,
      body: parsed.data.body,
      isPublic: parsed.data.isPublic,
      price: parsed.data.price
    }
  });

  const files = (req.files as Express.Multer.File[]) ?? [];
  const media = [];
  for (const file of files) {
    const { type } = await validateUploadedFile(file, "image-or-video");
    const url = storageProvider.publicUrl(file.filename);
    media.push(await prisma.media.create({ data: { postId: post.id, type, url } }));
  }
  const hasVideo = media.some((m) => m.type === "VIDEO");
  if (hasVideo) {
    await prisma.post.update({ where: { id: post.id }, data: { type: "VIDEO" } });
  }

  const subscriberIds = await prisma.profileSubscription.findMany({
    where: {
      profileId: req.session.userId!,
      status: "ACTIVE",
      expiresAt: { gt: new Date() }
    },
    select: { subscriberId: true }
  });
  if (subscriberIds.length) {
    await prisma.notification.createMany({
      data: subscriberIds.map((s) => ({
        userId: s.subscriberId,
        type: "POST_PUBLISHED",
        data: { postId: post.id, creatorId: req.session.userId! }
      }))
    });
  }

  return res.json({ post: { ...post, media } });
}));

creatorRouter.post("/creator/posts", upload.array("files", 10), asyncHandler(async (req, res) => {
  const ok = await ensureCreator(req.session.userId!);
  if (!ok) return res.status(403).json({ error: "FORBIDDEN" });

  const { title, body, isPublic, price } = req.body as Record<string, string>;
  const payload = {
    title,
    body,
    isPublic: isPublic === "true",
    price: price ? Number(price) : 0
  };
  const parsed = CreatePostSchema.safeParse(payload);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const post = await prisma.post.create({
    data: {
      authorId: req.session.userId!,
      title: parsed.data.title,
      body: parsed.data.body,
      isPublic: parsed.data.isPublic,
      price: parsed.data.price
    }
  });

  const files = (req.files as Express.Multer.File[]) ?? [];
  const media = [];
  for (const file of files) {
    const { type } = await validateUploadedFile(file, "image-or-video");
    const url = storageProvider.publicUrl(file.filename);
    media.push(await prisma.media.create({ data: { postId: post.id, type, url } }));
  }
  const hasVideo = media.some((m) => m.type === "VIDEO");
  if (hasVideo) {
    await prisma.post.update({ where: { id: post.id }, data: { type: "VIDEO" } });
  }

  const subscriberIds = await prisma.profileSubscription.findMany({
    where: {
      profileId: req.session.userId!,
      status: "ACTIVE",
      expiresAt: { gt: new Date() }
    },
    select: { subscriberId: true }
  });
  if (subscriberIds.length) {
    await prisma.notification.createMany({
      data: subscriberIds.map((s) => ({
        userId: s.subscriberId,
        type: "POST_PUBLISHED",
        data: { postId: post.id, creatorId: req.session.userId! }
      }))
    });
  }

  return res.json({ post: { ...post, media } });
}));

creatorRouter.put("/posts/mine/:id", asyncHandler(async (req, res) => {
  const ok = await ensureCreator(req.session.userId!);
  if (!ok) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = CreatePostSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const updated = await prisma.post.updateMany({
    where: { id: req.params.id, authorId: req.session.userId! },
    data: parsed.data
  });
  if (!updated.count) return res.status(404).json({ error: "NOT_FOUND" });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  return res.json({ post });
}));

creatorRouter.put("/creator/posts/:id", asyncHandler(async (req, res) => {
  const ok = await ensureCreator(req.session.userId!);
  if (!ok) return res.status(403).json({ error: "FORBIDDEN" });

  const parsed = CreatePostSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const updated = await prisma.post.updateMany({
    where: { id: req.params.id, authorId: req.session.userId! },
    data: parsed.data
  });
  if (!updated.count) return res.status(404).json({ error: "NOT_FOUND" });
  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  return res.json({ post });
}));

creatorRouter.delete("/posts/mine/:id", asyncHandler(async (req, res) => {
  const ok = await ensureCreator(req.session.userId!);
  if (!ok) return res.status(403).json({ error: "FORBIDDEN" });

  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || post.authorId !== req.session.userId!) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.post.delete({ where: { id: req.params.id } });
  return res.json({ ok: true });
}));

creatorRouter.delete("/creator/posts/:id", asyncHandler(async (req, res) => {
  const ok = await ensureCreator(req.session.userId!);
  if (!ok) return res.status(403).json({ error: "FORBIDDEN" });

  const post = await prisma.post.findUnique({ where: { id: req.params.id } });
  if (!post || post.authorId !== req.session.userId!) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.post.delete({ where: { id: req.params.id } });
  return res.json({ ok: true });
}));
