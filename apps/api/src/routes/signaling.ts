import { Router } from "express";
import { requireAuth } from "../lib/auth";
import { sendToUser } from "../realtime/sse";

export const signalingRouter = Router();

/**
 * WebRTC Signaling via SSE relay.
 *
 * Client → POST /signal/:type → server relays via SSE → target user
 * Target receives SSE event "signal:offer" | "signal:answer" | "signal:ice"
 */

// POST /signal/offer — send SDP offer to target user
signalingRouter.post("/signal/offer", requireAuth, (req, res) => {
  const { targetUserId, bookingId, streamId, sdp } = req.body;
  if (!targetUserId || !sdp) {
    return res.status(400).json({ error: "targetUserId and sdp required" });
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
signalingRouter.post("/signal/answer", requireAuth, (req, res) => {
  const { targetUserId, bookingId, streamId, sdp } = req.body;
  if (!targetUserId || !sdp) {
    return res.status(400).json({ error: "targetUserId and sdp required" });
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
signalingRouter.post("/signal/ice", requireAuth, (req, res) => {
  const { targetUserId, bookingId, streamId, candidate } = req.body;
  if (!targetUserId || !candidate) {
    return res.status(400).json({ error: "targetUserId and candidate required" });
  }

  sendToUser(targetUserId, "signal:ice", {
    fromUserId: req.session.userId!,
    bookingId: bookingId || null,
    streamId: streamId || null,
    candidate,
  });

  res.json({ ok: true });
});
