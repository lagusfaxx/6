import { API_URL } from "./api";

type Handler = (event: { type: string; data: any }) => void;

export function connectRealtime(handler: Handler) {
  if (typeof window === "undefined") return () => {};
  const url = `${API_URL.replace(/\/$/, "")}/realtime/stream`;

  let es: EventSource | null = null;
  let closed = false;
  let retryTimer: any = null;
  let retryAttempt = 0;

  const connect = () => {
    if (closed) return;
    try {
      es = new EventSource(url, { withCredentials: true } as any);

      // Single shared listener for all named event types (reduces listener count from 24+ to 1 per type)
      const knownEvents = [
        "hello", "message", "service_request", "ping",
        "notification",
        "forum:newThread", "forum:newPost",
        "videocall:booked", "videocall:started", "videocall:completed",
        "videocall:cancelled", "videocall:noshow", "videocall:user_joined", "videocall:chat",
        "live:started", "live:ended", "live:chat",
        "live:viewer_joined", "live:viewer_left", "live:tip",
        "live:private_show_started", "live:private_show_ended",
        "live:tip_option_added", "live:tip_option_removed", "live:config_updated",
        "signal:offer", "signal:answer", "signal:ice",
        "admin_event", "booking:new", "booking:update",
      ] as const;

      const eventHandler = (e: MessageEvent) => {
        try {
          handler({ type: e.type, data: JSON.parse(String(e.data || "{}")) });
        } catch {
          handler({ type: e.type, data: null });
        }
      };

      for (const evt of knownEvents) {
        es.addEventListener(evt, eventHandler);
      }

      es.onopen = () => {
        retryAttempt = 0;
        handler({ type: "connected", data: { ok: true } });
      };

      const scheduleReconnect = () => {
        if (closed) return;
        retryAttempt += 1;
        const baseDelay = 1500;
        const maxDelay = 30000;
        const expDelay = Math.min(
          maxDelay,
          baseDelay * 2 ** Math.min(retryAttempt, 4),
        );
        const jitter = Math.floor(Math.random() * 600);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, expDelay + jitter);
      };

      es.onerror = () => {
        handler({ type: "disconnected", data: null });
        es?.close();
        es = null;
        scheduleReconnect();
      };
    } catch {
      retryAttempt += 1;
      const delay = Math.min(30000, 1500 * 2 ** Math.min(retryAttempt, 4));
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, delay);
    }
  };

  connect();

  return () => {
    closed = true;
    clearTimeout(retryTimer);
    es?.close();
    es = null;
  };
}
