import { Router } from "express";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../lib/auth";
import { LocalStorageProvider } from "../storage/local";
import { env } from "../lib/env";
import path from "node:path";

export const adminRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const storage = new LocalStorageProvider(env.API_BASE_URL, path.join(process.cwd(), env.UPLOADS_DIR));

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
