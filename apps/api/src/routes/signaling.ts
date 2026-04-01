import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../lib/auth";
import { sendToUser } from "../realtime/sse";
import { prisma } from "../lib/prisma";

export const signalingRouter = Router();

const signalLimiter = rateLimit({
  windowMs: 10 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * WebRTC Signaling via SSE relay.
 *
 * Client → POST /signal/:type → server relays via SSE → target user
 * Target receives SSE event "signal:offer" | "signal:answer" | "signal:ice"
 */

const MAX_SDP_SIZE = 65_536; // 64KB max for SDP payloads
const MAX_CANDIDATE_SIZE = 2_048; // 2KB max for ICE candidates

function validateSignalInput(body: any): boolean {
  if (!body.targetUserId || typeof body.targetUserId !== "string") return false;
  if (body.targetUserId.length > 50) return false;
  return true;
}

function validateSdpSize(sdp: unknown): boolean {
  return typeof sdp === "string" || (typeof sdp === "object" && sdp !== null)
    ? JSON.stringify(sdp).length <= MAX_SDP_SIZE
    : false;
}

function validateCandidateSize(candidate: unknown): boolean {
  return typeof candidate === "string" || (typeof candidate === "object" && candidate !== null)
    ? JSON.stringify(candidate).length <= MAX_CANDIDATE_SIZE
    : false;
}

/**
 * Verify that the sender and target have an active relationship:
 * either a videocall booking or an active livestream.
 */
async function validateSignalRelationship(
  senderId: string,
  targetUserId: string,
  bookingId?: string | null,
  streamId?: string | null,
): Promise<boolean> {
  // If bookingId provided, verify both users are part of the booking
  if (bookingId) {
    const booking = await prisma.videocallBooking.findFirst({
      where: {
        id: bookingId,
        status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
        OR: [
          { clientId: senderId, professionalId: targetUserId },
          { clientId: targetUserId, professionalId: senderId },
        ],
      },
      select: { id: true },
    });
    return Boolean(booking);
  }

  // If streamId provided, verify the stream is active and sender/target are host or viewer
  if (streamId) {
    const stream = await prisma.liveStream.findFirst({
      where: { id: streamId, isActive: true },
      select: { hostId: true },
    });
    if (!stream) return false;
    // At least one of sender/target must be the host
    return stream.hostId === senderId || stream.hostId === targetUserId;
  }

  // No bookingId or streamId — reject (require a context)
  return false;
}

// POST /signal/offer — send SDP offer to target user
signalingRouter.post("/signal/offer", requireAuth, signalLimiter, async (req, res) => {
  const { targetUserId, bookingId, streamId, sdp } = req.body;
  if (!validateSignalInput(req.body) || !sdp) {
    return res.status(400).json({ error: "targetUserId and sdp required" });
  }
  if (!validateSdpSize(sdp)) {
    return res.status(400).json({ error: "SDP payload too large" });
  }
  if (targetUserId === req.session.userId) {
    return res.status(400).json({ error: "Cannot signal yourself" });
  }
  if (!(await validateSignalRelationship(req.session.userId!, targetUserId, bookingId, streamId))) {
    return res.status(403).json({ error: "No active booking or stream between users" });
  }

  sendToUser(targetUserId, "signal:offer", {
    fromUserId: req.session.userId!,
    bookingId: bookingId || null,
    streamId: streamId || null,
    sdp,
  });

  res.json({ ok: true });
});

// POST /signal/answer — send SDP answer to target user
signalingRouter.post("/signal/answer", requireAuth, signalLimiter, async (req, res) => {
  const { targetUserId, bookingId, streamId, sdp } = req.body;
  if (!validateSignalInput(req.body) || !sdp) {
    return res.status(400).json({ error: "targetUserId and sdp required" });
  }
  if (!validateSdpSize(sdp)) {
    return res.status(400).json({ error: "SDP payload too large" });
  }
  if (targetUserId === req.session.userId) {
    return res.status(400).json({ error: "Cannot signal yourself" });
  }
  if (!(await validateSignalRelationship(req.session.userId!, targetUserId, bookingId, streamId))) {
    return res.status(403).json({ error: "No active booking or stream between users" });
  }

  sendToUser(targetUserId, "signal:answer", {
    fromUserId: req.session.userId!,
    bookingId: bookingId || null,
    streamId: streamId || null,
    sdp,
  });

  res.json({ ok: true });
});

// POST /signal/ice — send ICE candidate to target user
signalingRouter.post("/signal/ice", requireAuth, signalLimiter, async (req, res) => {
  const { targetUserId, bookingId, streamId, candidate } = req.body;
  if (!validateSignalInput(req.body) || !candidate) {
    return res.status(400).json({ error: "targetUserId and candidate required" });
  }
  if (!validateCandidateSize(candidate)) {
    return res.status(400).json({ error: "ICE candidate too large" });
  }
  if (targetUserId === req.session.userId) {
    return res.status(400).json({ error: "Cannot signal yourself" });
  }
  if (!(await validateSignalRelationship(req.session.userId!, targetUserId, bookingId, streamId))) {
    return res.status(403).json({ error: "No active booking or stream between users" });
  }

  sendToUser(targetUserId, "signal:ice", {
    fromUserId: req.session.userId!,
    bookingId: bookingId || null,
    streamId: streamId || null,
    candidate,
  });

  res.json({ ok: true });
});
