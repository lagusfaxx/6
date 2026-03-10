"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { connectRealtime } from "../lib/realtime";
import useMe from "../hooks/useMe";

type LiveStartedEvent = {
  streamId: string;
  hostId?: string;
  hostName?: string;
  hostAvatarUrl?: string | null;
  notificationText?: string;
  ctaUrl?: string;
};

type ToastItem = {
  id: string;
  text: string;
  url: string;
  avatarUrl?: string | null;
};

const MAX_TOASTS = 3;
const DISMISS_MS = 8000;

export default function LiveStartedNotifications() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { me, loading } = useMe();

  useEffect(() => {
    if (loading || !me?.user?.id) return;

    const cleanup = connectRealtime((event) => {
      if (event.type !== "live:started" && event.type !== "notification:live_started") return;

      const data = (event.data || {}) as LiveStartedEvent;
      if (!data.streamId) return;
      if (data.hostId && data.hostId === me.user.id) return;

      const id = `live-started-${data.streamId}`;
      const text = data.notificationText || `🔴 ${data.hostName || "Una profesional"} está en vivo ahora`;
      const url = data.ctaUrl || `/live/${data.streamId}`;

      setToasts((prev) => {
        if (prev.some((t) => t.id === id)) return prev;
        return [{ id, text, url, avatarUrl: data.hostAvatarUrl }, ...prev].slice(0, MAX_TOASTS);
      });

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, DISMISS_MS);
    });

    return cleanup;
  }, [loading, me?.user?.id]);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed right-3 top-[84px] z-[80] flex w-[300px] max-w-[calc(100vw-1.5rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto overflow-hidden rounded-xl border border-red-400/30 bg-[#121212]/95 shadow-xl backdrop-blur"
        >
          <div className="flex items-center gap-3 p-3">
            {toast.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={toast.avatarUrl} alt="Avatar" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/20 text-red-300">🔴</div>
            )}
            <div className="min-w-0 flex-1 text-sm text-white">{toast.text}</div>
          </div>
          <Link href={toast.url} className="block border-t border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-red-200">
            Ir al live
          </Link>
        </div>
      ))}
    </div>
  );
}
