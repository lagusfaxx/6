import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { registerSseClient } from "./sse";

export const realtimeRouter = Router();

/**
 * SSE stream for realtime events (messages, service requests, notifications).
 * The frontend connects with EventSource({ withCredentials:true }) to preserve session cookie.
 */
realtimeRouter.get(
  "/realtime/stream",
  requireAuth,
  asyncHandler(async (req, res) => {
    const me = req.session.userId;
    if (!me) return res.status(401).json({ error: "UNAUTHENTICATED" });

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Initial hello
    res.write(`event: hello\n`);
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);

    registerSseClient(me, res);

    // Heartbeat to keep proxies alive
    const interval = setInterval(() => {
      try {
        res.write(`event: ping\n`);
        res.write(`data: ${JSON.stringify({ t: Date.now() })}\n\n`);
      } catch {}
    }, 25000);

    req.on("close", () => clearInterval(interval));
  })
);
