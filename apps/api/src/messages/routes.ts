import { Router } from "express";
import multer from "multer";
import path from "node:path";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { canMessage } from "./canMessage";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { config } from "../config";
import { validateUploadedFile } from "../lib/uploads";
import { optimizeUploadedImage } from "../lib/imageOptimizer";
import { isUUID } from "../lib/validators";
import { sendToUser, broadcast } from "../realtime/sse";

export const messagesRouter = Router();

const messageLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: { error: "TOO_MANY_MESSAGES", message: "Demasiados mensajes. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`
});

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
  limits: { fileSize: 25 * 1024 * 1024 }
});

// IMPORTANT: keep specific routes before parameterized routes (Express matches in order).
// Otherwise /messages/inbox is captured by /messages/:userId and Prisma will throw
// "Inconsistent column data" (P2023) because "inbox" is not a UUID.

messagesRouter.get("/messages/unread-count", requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.userId;
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });
  const count = await prisma.message.count({
    where: { toId: me, readAt: null }
  });
  return res.json({ count });
}));

messagesRouter.get("/messages/inbox", requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.userId;
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });

  const messages = await prisma.message.findMany({
    where: {
      OR: [{ fromId: me }, { toId: me }]
    },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  const conversationMap = new Map<string, typeof messages[number]>();
  for (const message of messages) {
    const otherId = message.fromId === me ? message.toId : message.fromId;
    if (!conversationMap.has(otherId)) {
      conversationMap.set(otherId, message);
    }
  }

  const otherIds = Array.from(conversationMap.keys()).filter(isUUID);
  const others = otherIds.length
    ? await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        profileType: true,
        city: true
      }
    })
    : [];
  const otherMap = new Map(others.map((u) => [u.id, u]));

  const unreadCounts = otherIds.length
    ? await prisma.message.groupBy({
      by: ["fromId"],
      where: { toId: me, readAt: null, fromId: { in: otherIds } },
      _count: { _all: true }
    })
    : [];
  const unreadMap = new Map(unreadCounts.map((r) => [r.fromId, r._count._all]));

  const conversations = otherIds
    .map((otherId) => ({
      other: otherMap.get(otherId),
      lastMessage: conversationMap.get(otherId),
      unreadCount: unreadMap.get(otherId) || 0
    }))
    .filter((c) => c.other && c.lastMessage);

  return res.json({ conversations });
}));

messagesRouter.get("/messages/:userId", requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.userId;
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });
  const other = req.params.userId;
  if (!isUUID(other)) return res.status(400).json({ error: "INVALID_TARGET_ID" });
  const allowed = await canMessage(me, other);
  if (!allowed) return res.status(403).json({ error: "CHAT_NOT_ALLOWED" });
  const otherUser = await prisma.user.findUnique({
    where: { id: other },
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      profileType: true,
      city: true
    }
  });
  if (!otherUser) return res.status(404).json({ error: "USER_NOT_FOUND" });

  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { fromId: me, toId: other },
        { fromId: other, toId: me }
      ]
    },
    orderBy: { createdAt: "asc" },
    take: 200
  });
  await prisma.message.updateMany({
    where: { fromId: other, toId: me, readAt: null },
    data: { readAt: new Date() }
  });
  return res.json({ messages, other: otherUser });
}));

messagesRouter.post("/messages/:userId", requireAuth, messageLimiter, asyncHandler(async (req, res) => {
  const me = req.session.userId;
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });
  const other = req.params.userId;
  if (!isUUID(other)) return res.status(400).json({ error: "INVALID_TARGET_ID" });
  const allowed = await canMessage(me, other);
  if (!allowed) return res.status(403).json({ error: "CHAT_NOT_ALLOWED" });
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ error: "EMPTY_MESSAGE" });
  if (body.length > 5000) return res.status(400).json({ error: "MESSAGE_TOO_LONG", message: "Máximo 5000 caracteres por mensaje" });
  const message = await prisma.message.create({
    data: {
      fromId: me,
      toId: other,
      body
    }
  });
  await prisma.notification.create({
    data: {
      userId: other,
      type: "MESSAGE_RECEIVED",
      data: { title: "Nuevo mensaje", body: body.slice(0, 100), fromId: me, messageId: message.id, url: `/chat/${me}` }
    }
  }).catch((err) => {
    console.error("[messages] Failed to create notification:", err?.message || err);
  });

  // Track response time — find last unanswered message from `other` to `me`
  try {
    const lastIncoming = await prisma.message.findFirst({
      where: { fromId: other, toId: me },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (lastIncoming) {
      const diffMin = Math.round((Date.now() - lastIncoming.createdAt.getTime()) / 60000);
      if (diffMin >= 0 && diffMin <= 1440) {
        // Weighted rolling average (last 20 responses)
        const user = await prisma.user.findUnique({ where: { id: me }, select: { avgResponseMinutes: true } });
        const prev = user?.avgResponseMinutes ?? diffMin;
        const newAvg = Math.round(prev * 0.9 + diffMin * 0.1);
        await prisma.user.update({ where: { id: me }, data: { avgResponseMinutes: newAvg } });
      }
    }
  } catch { /* non-critical — don't block message sending */ }

  // Realtime push — include sender info for real-time UI updates
  const sender = await prisma.user.findUnique({
    where: { id: me },
    select: { id: true, displayName: true, username: true, avatarUrl: true, profileType: true, city: true }
  });
  sendToUser(other, "message", { message, from: sender ?? undefined });

  // Social proof broadcast — notify all connected users
  const recipient = await prisma.user.findUnique({
    where: { id: other },
    select: { displayName: true, username: true, profileType: true },
  });
  if (recipient?.profileType === "PROFESSIONAL") {
    broadcast("social_proof", {
      kind: "message",
      displayName: recipient.displayName || recipient.username,
      profileId: other,
      t: Date.now(),
    });
  }

  return res.json({ message });
}));

messagesRouter.post("/messages/:userId/attachment", requireAuth, messageLimiter, upload.single("file"), asyncHandler(async (req, res) => {
  const me = req.session.userId;
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });
  const other = req.params.userId;
  if (!isUUID(other)) return res.status(400).json({ error: "INVALID_TARGET_ID" });
  const allowed = await canMessage(me, other);
  if (!allowed) return res.status(403).json({ error: "CHAT_NOT_ALLOWED" });
  const file = req.file;
  if (!file) return res.status(400).json({ error: "NO_FILE" });
  const { type } = await validateUploadedFile(file, "image");
  if (type !== "IMAGE") return res.status(400).json({ error: "INVALID_FILE_TYPE" });
  // Resize, watermark and re-encode as WebP. Returns the `wm_` prefixed
  // filename so the stored URL matches the on-disk file.
  const finalFilename = await optimizeUploadedImage(file, "gallery");
  const url = storageProvider.publicUrl(finalFilename);
  const message = await prisma.message.create({
    data: {
      fromId: me,
      toId: other,
      body: `ATTACHMENT_IMAGE:${url}`
    }
  });
  await prisma.notification.create({
    data: {
      userId: other,
      type: "MESSAGE_RECEIVED",
      data: { title: "Imagen recibida", body: "Te enviaron una imagen", fromId: me, messageId: message.id, url: `/chat/${me}` }
    }
  }).catch((err) => {
    console.error("[messages] Failed to create attachment notification:", err?.message || err);
  });

  const sender = await prisma.user.findUnique({
    where: { id: me },
    select: { id: true, displayName: true, username: true, avatarUrl: true, profileType: true, city: true }
  });
  sendToUser(other, "message", { message, from: sender ?? undefined });

  // Social proof broadcast
  const attachRecipient = await prisma.user.findUnique({
    where: { id: other },
    select: { displayName: true, username: true, profileType: true },
  });
  if (attachRecipient?.profileType === "PROFESSIONAL") {
    broadcast("social_proof", {
      kind: "message",
      displayName: attachRecipient.displayName || attachRecipient.username,
      profileId: other,
      t: Date.now(),
    });
  }

  return res.json({ message });
}));
