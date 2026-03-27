import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../lib/auth";
import { sendToUser } from "../realtime/sse";

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

function validateSignalInput(body: any): boolean {
  if (!body.targetUserId || typeof body.targetUserId !== "string") return false;
  if (body.targetUserId.length > 50) return false;
  return true;
}

// POST /signal/offer — send SDP offer to target user
signalingRouter.post("/signal/offer", requireAuth, signalLimiter, (req, res) => {
  const { targetUserId, bookingId, streamId, sdp } = req.body;
  if (!validateSignalInput(req.body) || !sdp) {
    return res.status(400).json({ error: "targetUserId and sdp required" });
  }
  if (targetUserId === req.session.userId) {
    return res.status(400).json({ error: "Cannot signal yourself" });
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
signalingRouter.post("/signal/answer", requireAuth, signalLimiter, (req, res) => {
  const { targetUserId, bookingId, streamId, sdp } = req.body;
  if (!validateSignalInput(req.body) || !sdp) {
    return res.status(400).json({ error: "targetUserId and sdp required" });
  }
  if (targetUserId === req.session.userId) {
    return res.status(400).json({ error: "Cannot signal yourself" });
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
signalingRouter.post("/signal/ice", requireAuth, signalLimiter, (req, res) => {
  const { targetUserId, bookingId, streamId, candidate } = req.body;
  if (!validateSignalInput(req.body) || !candidate) {
    return res.status(400).json({ error: "targetUserId and candidate required" });
  }
  if (targetUserId === req.session.userId) {
    return res.status(400).json({ error: "Cannot signal yourself" });
  }

  sendToUser(targetUserId, "signal:ice", {
    fromUserId: req.session.userId!,
    bookingId: bookingId || null,
    streamId: streamId || null,
    candidate,
  });

  res.json({ ok: true });
});
