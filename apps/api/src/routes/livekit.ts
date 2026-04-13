import { Router } from "express";
import { AccessToken, type VideoGrant } from "livekit-server-sdk";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";

const livekitRouter = Router();

type TokenBody = {
  roomName?: unknown;
  streamId?: unknown;
  bookingId?: unknown;
  kind?: unknown;
};

function getLivekitConfig() {
  const url = process.env.LIVEKIT_URL || "";
  const apiKey = process.env.LIVEKIT_API_KEY || "";
  const apiSecret = process.env.LIVEKIT_API_SECRET || "";

  if (!url || !apiKey || !apiSecret) {
    throw new Error("LIVEKIT_NOT_CONFIGURED");
  }

  if (apiSecret.length < 32) {
    console.warn("[livekit] LIVEKIT_API_SECRET is shorter than 32 characters — LiveKit requires at least 32 chars for security");
  }

  return { url, apiKey, apiSecret };
}

livekitRouter.post("/livekit/token", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const body = (req.body || {}) as TokenBody;
  const roomName = String(body.roomName || "").trim();
  const streamId = body.streamId ? String(body.streamId) : null;
  const bookingId = body.bookingId ? String(body.bookingId) : null;
  const kind = String(body.kind || "").trim();

  if (!roomName) {
    return res.status(400).json({ error: "roomName required" });
  }

  let canPublish = false;

  if (kind === "live") {
    if (!streamId) return res.status(400).json({ error: "streamId required for live" });

    const stream = await prisma.liveStream.findUnique({
      where: { id: streamId },
      select: { id: true, hostId: true, isActive: true },
    });

    if (!stream || !stream.isActive) return res.status(404).json({ error: "Stream not active" });

    if (roomName !== `live:${stream.id}`) {
      return res.status(400).json({ error: "Invalid roomName for stream" });
    }

    canPublish = stream.hostId === userId;
  } else if (kind === "videocall") {
    if (!bookingId) return res.status(400).json({ error: "bookingId required for videocall" });

    const booking = await prisma.videocallBooking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        clientId: true,
        professionalId: true,
        roomId: true,
        status: true,
      },
    });

    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (booking.clientId !== userId && booking.professionalId !== userId) {
      return res.status(403).json({ error: "Not your booking" });
    }

    if (!["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
      return res.status(400).json({ error: "Videocall not available" });
    }

    if (!booking.roomId || roomName !== `videocall:${booking.roomId}`) {
      return res.status(400).json({ error: "Invalid roomName for booking" });
    }

    canPublish = true;
  } else {
    return res.status(400).json({ error: "kind must be live or videocall" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true },
  });

  if (!user) return res.status(404).json({ error: "User not found" });

  let cfg;
  try {
    cfg = getLivekitConfig();
  } catch {
    return res.status(500).json({ error: "LIVEKIT_NOT_CONFIGURED" });
  }

  const grant: VideoGrant = {
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
  };

  const token = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: user.id,
    name: user.displayName || user.username || user.id,
    ttl: "1h",
  });

  token.addGrant(grant);

  res.json({ token: await token.toJwt(), url: cfg.url, roomName, canPublish });
});

export { livekitRouter };
