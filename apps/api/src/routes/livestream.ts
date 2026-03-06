import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { broadcast, sendToUser } from "../realtime/sse";

export const livestreamRouter = Router();

// ── POST /live/start — professional starts a live stream ──
livestreamRouter.post("/live/start", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") {
    return res.status(403).json({ error: "Only professionals can go live" });
  }

  // Check no active stream
  const existing = await prisma.liveStream.findFirst({
    where: { hostId: userId, isActive: true },
  });
  if (existing) return res.status(400).json({ error: "Already streaming", streamId: existing.id });

  const stream = await prisma.liveStream.create({
    data: {
      hostId: userId,
      title: req.body.title || null,
    },
  });

  // Broadcast to all connected users that a new live started
  broadcast("live:started", {
    streamId: stream.id,
    hostId: userId,
    title: stream.title,
  });

  res.json({ stream });
});

// ── POST /live/:id/end — end the live stream ──
livestreamRouter.post("/live/:id/end", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ error: "Not found" });
  if (stream.hostId !== req.session.userId!) return res.status(403).json({ error: "Not your stream" });
  if (!stream.isActive) return res.status(400).json({ error: "Already ended" });

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { isActive: false, endedAt: new Date() },
  });

  broadcast("live:ended", { streamId: stream.id, hostId: stream.hostId });

  res.json({ ok: true });
});

// ── GET /live/active — list active streams ──
livestreamRouter.get("/live/active", async (_req, res) => {
  const streams = await prisma.liveStream.findMany({
    where: { isActive: true },
    orderBy: { startedAt: "desc" },
    include: {
      host: {
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      },
    },
  });
  res.json({ streams });
});

// ── GET /live/:id — get stream details ──
livestreamRouter.get("/live/:id", async (req, res) => {
  const stream = await prisma.liveStream.findUnique({
    where: { id: req.params.id },
    include: {
      host: {
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });
  if (!stream) return res.status(404).json({ error: "Not found" });
  res.json({ stream });
});

// ── POST /live/:id/join — viewer joins a live stream ──
livestreamRouter.post("/live/:id/join", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream || !stream.isActive) return res.status(404).json({ error: "Stream not active" });
  if (stream.viewerCount >= stream.maxViewers) {
    return res.status(400).json({ error: "Stream is full (max viewers reached)" });
  }

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { viewerCount: { increment: 1 } },
  });

  // Notify host
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: { displayName: true, username: true },
  });
  sendToUser(stream.hostId, "live:viewer_joined", {
    streamId: stream.id,
    viewerName: user?.displayName || user?.username || "Alguien",
    viewerCount: stream.viewerCount + 1,
  });

  res.json({ ok: true, viewerCount: stream.viewerCount + 1 });
});

// ── POST /live/:id/leave — viewer leaves ──
livestreamRouter.post("/live/:id/leave", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream) return res.status(404).json({ error: "Not found" });

  await prisma.liveStream.update({
    where: { id: stream.id },
    data: { viewerCount: Math.max(0, stream.viewerCount - 1) },
  });

  sendToUser(stream.hostId, "live:viewer_left", {
    streamId: stream.id,
    viewerCount: Math.max(0, stream.viewerCount - 1),
  });

  res.json({ ok: true });
});

// ── POST /live/:id/chat — send message in live chat ──
livestreamRouter.post("/live/:id/chat", requireAuth, async (req, res) => {
  const stream = await prisma.liveStream.findUnique({ where: { id: req.params.id } });
  if (!stream || !stream.isActive) return res.status(400).json({ error: "Stream not active" });

  const message = String(req.body.message || "").trim().slice(0, 300);
  if (!message) return res.status(400).json({ error: "Message required" });

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: { displayName: true, username: true },
  });

  const chatMsg = await prisma.liveChatMessage.create({
    data: {
      streamId: stream.id,
      userId: req.session.userId!,
      message,
    },
  });

  // Broadcast to host (who then relays via WebRTC data channel or SSE)
  sendToUser(stream.hostId, "live:chat", {
    streamId: stream.id,
    messageId: chatMsg.id,
    userId: req.session.userId!,
    userName: user?.displayName || user?.username || "Anónimo",
    message,
    createdAt: chatMsg.createdAt.toISOString(),
  });

  res.json({ message: chatMsg });
});
