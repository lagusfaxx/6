"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown } from "lucide-react";
import Avatar from "./Avatar";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";

type NotificationItem = {
  id: string;
  type: string;
  data?: any;
  readAt?: string | null;
  createdAt: string;
};

function notificationLabel(item: NotificationItem): string {
  switch (item.type) {
    case "MESSAGE_RECEIVED":
      return "Tienes un mensaje nuevo";
    case "SERVICE_PUBLISHED":
      return "Se publicó una solicitud de servicio";
    case "POST_PUBLISHED":
      return "Hay una actualización reciente";
    case "SUBSCRIPTION_STARTED":
      return "Tu suscripción fue activada";
    case "SUBSCRIPTION_RENEWED":
      return "Tu suscripción fue renovada";
    default:
      return "Nueva notificación";
  }
}

function notificationTime(iso: string): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(date);
}

export default function TopHeader() {
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const [panelOpen, setPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAuthed) {
      setNotifications([]);
      return;
    }

    setLoadingNotifications(true);
    apiFetch<{ notifications: NotificationItem[] }>("/notifications")
      .then((res) => setNotifications(res?.notifications ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotifications(false));
  }, [isAuthed]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications]
  );

  const recentItems = notifications.slice(0, 5);

  const markAsRead = async (id: string) => {
    try {
      await apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch {
      // silencioso: no bloquea UX
    }
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-50 md:left-[240px]">
      <div className="mx-2 mt-2 rounded-2xl border border-white/20 bg-black/55 px-3 py-2 shadow-[0_12px_38px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:mx-4 md:mt-3 md:rounded-3xl md:px-5 md:py-3">
        <div className="flex min-h-[58px] items-center justify-between md:min-h-[68px]">
          <Link href="/" className="flex items-center gap-3.5">
            <img
              src="/brand/isotipo-new.png"
              alt="UZEED"
              className="h-14 w-14 object-contain drop-shadow-[0_8px_24px_rgba(168,85,247,0.45)] md:h-16 md:w-16"
            />
            <div className="min-w-0">
              <div className="text-2xl font-black leading-none text-white drop-shadow-[0_6px_18px_rgba(168,85,247,0.65)] md:text-[2rem]">UZEED</div>
            </div>
          </Link>

          <div className="flex items-center gap-2 md:gap-3">
            {isAuthed ? (
              <div className="relative" ref={panelRef}>
                <button
                  type="button"
                  onClick={() => setPanelOpen((prev) => !prev)}
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/15 text-white transition hover:bg-white/20"
                  aria-label="Abrir notificaciones"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 ? (
                    <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-[0_0_12px_rgba(217,70,239,0.7)]">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  ) : null}
                </button>

                {panelOpen ? (
                  <div className="absolute right-0 top-14 w-[300px] overflow-hidden rounded-2xl border border-white/15 bg-[#0a0b1de6] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:w-[340px]">
                    <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Notificaciones</div>
                    <div className="max-h-[320px] overflow-y-auto p-2">
                      {loadingNotifications ? (
                        <div className="rounded-xl px-3 py-4 text-sm text-white/70">Cargando…</div>
                      ) : recentItems.length ? (
                        <div className="space-y-1">
                          {recentItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => markAsRead(item.id)}
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-white/10"
                            >
                              <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.readAt ? "bg-white/30" : "bg-fuchsia-400"}`} />
                              <div className="min-w-0">
                                <div className="text-sm text-white/95">{notificationLabel(item)}</div>
                                <div className="mt-1 text-[11px] text-white/55">{notificationTime(item.createdAt)}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl px-3 py-4 text-sm text-white/65">No tienes notificaciones recientes.</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <Link
              href={isAuthed ? "/cuenta" : "/login?next=%2Fcuenta"}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-1.5 py-1.5 transition hover:bg-white/20"
            >
              <Avatar src={me?.user?.avatarUrl} alt="Cuenta" size={34} className="border-white/20" />
              <ChevronDown className="mr-1 hidden h-4 w-4 text-white/70 md:block" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
