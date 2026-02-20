"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, Menu, X, Heart, Home, MessageCircle, Briefcase, User, Hotel } from "lucide-react";
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

const navItems = [
  { href: "/", label: "Home", icon: Home, protected: false },
  { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/servicios", label: "Servicios", icon: Briefcase, protected: false },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: false }
];

export default function Header() {
  const { me } = useMe();
  const pathname = usePathname() || "/";
  const isAuthed = Boolean(me?.user?.id);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const notifPanelRef = useRef<HTMLDivElement | null>(null);

  // Determine nav items based on user role
  const role = String(me?.user?.role || "").toUpperCase();
  const ptype = String(me?.user?.profileType || "").toUpperCase();
  const isMotelProfile = ptype === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";

  const dynamicItems = isMotelProfile
    ? [
        { href: "/dashboard/motel", label: "Dashboard", icon: Hotel, protected: true },
        { href: "/chats", label: "Chat", icon: MessageCircle, protected: true }
      ]
    : navItems;

  // Load notifications
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

  // Close notification panel on outside click
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!notifPanelRef.current) return;
      if (!notifPanelRef.current.contains(event.target as Node)) {
        setNotifPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

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
    <>
      <header className="fixed left-0 right-0 top-0 z-50 md:left-[240px]">
        <div className="w-full border-b border-white/10 bg-gradient-to-r from-black/60 via-purple-950/40 to-black/60 px-3 py-2 backdrop-blur-xl shadow-lg shadow-purple-500/10 md:px-5 md:py-2.5">
          <div className="flex min-h-[56px] items-center justify-between md:min-h-[64px]">
            {/* Left side: Logo + Hamburger (mobile only) */}
            <div className="flex items-center gap-3">
              {/* Hamburger Menu Button - Mobile Only */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition-all hover:bg-white/20 hover:border-purple-400/40 active:scale-95"
                aria-label="Menú"
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>

              {/* Logo */}
              <Link href="/" className="flex items-center gap-3">
                <img
                  src="/brand/isotipo-new.png"
                  alt="UZEED"
                  className="h-[52px] w-[52px] object-contain drop-shadow-[0_8px_24px_rgba(168,85,247,0.65)] transition-all hover:drop-shadow-[0_8px_32px_rgba(168,85,247,0.85)] md:h-14 md:w-14"
                />
                <div className="min-w-0">
                  <div className="text-[32px] font-bold leading-none tracking-tight text-white drop-shadow-[0_4px_16px_rgba(168,85,247,0.55)] md:text-[36px] bg-gradient-to-r from-purple-200 via-fuchsia-200 to-purple-300 bg-clip-text text-transparent">
                    Uzeed
                  </div>
                </div>
              </Link>
            </div>

            {/* Right side: Notifications + User */}
            <div className="flex items-center gap-2 md:gap-3">
              {isAuthed ? (
                <div className="relative" ref={notifPanelRef}>
                  <button
                    type="button"
                    onClick={() => setNotifPanelOpen((prev) => !prev)}
                    className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition-all hover:bg-white/20 hover:border-purple-400/40 active:scale-95"
                    aria-label="Abrir notificaciones"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute right-1 top-1 min-w-5 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-600 px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white shadow-[0_0_16px_rgba(217,70,239,0.8)] animate-pulse">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </button>

                  {notifPanelOpen ? (
                    <div className="absolute right-0 top-14 w-[300px] overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#0a0b1df5] via-[#0e0d1ff5] to-[#0a0b1df5] shadow-[0_20px_60px_rgba(139,92,246,0.4)] backdrop-blur-2xl md:w-[340px]">
                      <div className="border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 px-4 py-3 text-sm font-semibold">
                        Notificaciones
                      </div>
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
                                className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-all hover:bg-white/10"
                              >
                                <div className={`mt-1 h-2.5 w-2.5 rounded-full ${item.readAt ? "bg-white/30" : "bg-fuchsia-400 shadow-[0_0_8px_rgba(217,70,239,0.8)]"}`} />
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
                className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-1.5 py-1.5 transition-all hover:bg-white/20 hover:border-purple-400/40 active:scale-95"
              >
                <Avatar src={me?.user?.avatarUrl} alt="Cuenta" size={34} className="border-white/30 ring-2 ring-purple-400/20" />
                <ChevronDown className="mr-1 hidden h-4 w-4 text-white/70 md:block" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed left-0 top-0 z-40 h-full w-[280px] transform border-r border-purple-500/20 bg-gradient-to-b from-[#0a0b1df8] via-[#0e0d1ff8] to-[#0a0b1df8] shadow-2xl shadow-purple-500/20 backdrop-blur-xl transition-transform duration-300 ease-out md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          {/* Menu Header */}
          <div className="border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 px-5 py-6">
            <div className="flex items-center gap-3">
              <img
                src="/brand/isotipo-new.png"
                alt="UZEED"
                className="h-12 w-12 object-contain drop-shadow-[0_6px_20px_rgba(168,85,247,0.7)]"
              />
              <div className="text-2xl font-bold leading-none tracking-tight bg-gradient-to-r from-purple-200 via-fuchsia-200 to-purple-300 bg-clip-text text-transparent">
                Uzeed
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-2">
              {dynamicItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const href = item.protected && !isAuthed
                  ? `/login?next=${encodeURIComponent(item.href)}`
                  : item.href;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] font-medium transition-all ${
                      active
                        ? "bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-white shadow-lg shadow-purple-500/20 border border-purple-400/30"
                        : "text-white/75 hover:bg-white/10 hover:text-white border border-transparent"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-purple-300" : ""}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Menu Footer */}
          <div className="border-t border-white/10 bg-gradient-to-r from-purple-500/5 to-fuchsia-500/5 p-4">
            <p className="text-xs text-white/50 leading-relaxed">
              Encuentra profesionales y establecimientos confiables.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
