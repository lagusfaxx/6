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
  const url = await storage.save(file);
  res.json({ url });
});

