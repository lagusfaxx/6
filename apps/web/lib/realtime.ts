import { API_URL } from "./api";

type Handler = (event: { type: string; data: any }) => void;

export function connectRealtime(handler: Handler) {
  if (typeof window === "undefined") return () => {};
  const url = `${API_URL.replace(/\/$/, "")}/realtime/stream`;

  let es: EventSource | null = null;
  let closed = false;
  let retryTimer: any = null;

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

      es.onerror = () => {
        handler({ type: "disconnected", data: null });
        // Reconnect with backoff
        es?.close();
        es = null;
        if (closed) return;
        clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, 1500);
      };
    } catch {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(connect, 1500);
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
