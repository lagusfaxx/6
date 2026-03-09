import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { canMessage } from "./canMessage";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { config } from "../config";
import { validateUploadedFile } from "../lib/uploads";
import { isUUID } from "../lib/validators";
import { sendToUser } from "../realtime/sse";

export const messagesRouter = Router();

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

messagesRouter.post("/messages/:userId", requireAuth, asyncHandler(async (req, res) => {
  const me = req.session.userId;
  if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (!isUUID(me)) return res.status(400).json({ error: "INVALID_USER_ID" });
  const other = req.params.userId;
  if (!isUUID(other)) return res.status(400).json({ error: "INVALID_TARGET_ID" });
  const allowed = await canMessage(me, other);
  if (!allowed) return res.status(403).json({ error: "CHAT_NOT_ALLOWED" });
  const body = String(req.body?.body || "").trim();
  if (!body) return res.status(400).json({ error: "EMPTY_MESSAGE" });
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
      data: { fromId: me, messageId: message.id }
    }
  });

  // Realtime push
  sendToUser(other, "message", { message });
  return res.json({ message });
}));

messagesRouter.post("/messages/:userId/attachment", requireAuth, upload.single("file"), asyncHandler(async (req, res) => {
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
  const url = storageProvider.publicUrl(file.filename);
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
      data: { fromId: me, messageId: message.id }
    }
  });

  sendToUser(other, "message", { message });
  return res.json({ message });
}));
