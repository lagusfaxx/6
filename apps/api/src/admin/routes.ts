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

adminRouter.use(requireAdmin);

adminRouter.get("/stats", asyncHandler(async (_req, res) => {
  const [users, posts, payments] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.payment.count()
  ]);
  return res.json({ users, posts, payments });
}));

adminRouter.get("/posts", asyncHandler(async (_req, res) => {
  const posts = await prisma.post.findMany({ orderBy: { createdAt: "desc" }, include: { media: true } });
  return res.json({ posts: posts.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    media: p.media.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
  })) });
}));

adminRouter.post("/posts", upload.array("files", 10), asyncHandler(async (req, res) => {
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
    const mime = (file.mimetype || "").toLowerCase();
    const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
    const url = storageProvider.publicUrl(file.filename);
    media.push(await prisma.media.create({ data: { postId: post.id, type, url } }));
  }
  const hasVideo = media.some((m) => m.type === "VIDEO");
  if (hasVideo) {
    await prisma.post.update({ where: { id: post.id }, data: { type: "VIDEO" } });
  }

  return res.json({ post: { ...post, media } });
}));

adminRouter.put("/posts/:id", asyncHandler(async (req, res) => {
  const parsed = CreatePostSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "VALIDATION", details: parsed.error.flatten() });

  const post = await prisma.post.update({
    where: { id: req.params.id },
    data: parsed.data
  });
  return res.json({ post });
}));

adminRouter.delete("/posts/:id", asyncHandler(async (req, res) => {
  await prisma.post.delete({ where: { id: req.params.id } });
  return res.json({ ok: true });
}));

adminRouter.post("/posts/:id/media", upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });
  const mime = (req.file.mimetype || "").toLowerCase();
  const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
  const url = storageProvider.publicUrl(req.file.filename);

  const media = await prisma.media.create({
    data: { postId: req.params.id, type, url }
  });
  if (type === "VIDEO") {
    await prisma.post.update({ where: { id: req.params.id }, data: { type: "VIDEO" } });
  }

  return res.json({ media });
}));
