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

      es.addEventListener("hello", (e: MessageEvent) => {
        try {
          handler({ type: "hello", data: JSON.parse(String(e.data || "{}")) });
        } catch {
          handler({ type: "hello", data: null });
        }
      });

      es.onopen = () => {
        retryAttempt = 0;
        handler({ type: "connected", data: { ok: true } });
      };

      es.addEventListener("message", (e: MessageEvent) => {
        try {
          handler({ type: "message", data: JSON.parse(String(e.data || "{}")) });
        } catch {
          handler({ type: "message", data: null });
        }
      });

      es.addEventListener("service_request", (e: MessageEvent) => {
        try {
          handler({ type: "service_request", data: JSON.parse(String(e.data || "{}")) });
        } catch {
          handler({ type: "service_request", data: null });
        }
      });

      es.addEventListener("ping", (e: MessageEvent) => {
        try {
          handler({ type: "ping", data: JSON.parse(String(e.data || "{}")) });
        } catch {
          handler({ type: "ping", data: null });
        }
      });

      for (const evt of [
        "forum:newThread", "forum:newPost",
        "videocall:booked", "videocall:started", "videocall:completed",
        "videocall:cancelled", "videocall:noshow", "videocall:user_joined", "videocall:chat",
        "live:started", "live:ended", "live:chat",
        "live:viewer_joined", "live:viewer_left",
        "signal:offer", "signal:answer", "signal:ice",
      ] as const) {
        es.addEventListener(evt, (e: MessageEvent) => {
          try {
            handler({ type: evt, data: JSON.parse(String(e.data || "{}")) });
          } catch {
            handler({ type: evt, data: null });
          }
        });
      }

      const scheduleReconnect = () => {
        if (closed) return;
        retryAttempt += 1;
        const baseDelay = 1500;
        const maxDelay = 30000;
        const expDelay = Math.min(maxDelay, baseDelay * (2 ** Math.min(retryAttempt, 4)));
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
      const delay = Math.min(30000, 1500 * (2 ** Math.min(retryAttempt, 4)));
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
