"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Compass,
  Crown,
  Home,
  MessageCircle,
  Plus,
  Search,
  User,
} from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type NotificationItem = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

function notifLabel(item: NotificationItem): string {
  if (item.data?.title && typeof item.data.title === "string") return item.data.title;
  switch (item.type) {
    case "MESSAGE_RECEIVED":          return "Nuevo mensaje";
    case "SUBSCRIPTION_STARTED":      return "Suscripción activada";
    case "SUBSCRIPTION_RENEWED":      return "Suscripción renovada";
    case "POST_PUBLISHED":            return "Nueva publicación";
    default:                          return "Nueva notificación";
  }
}

function notifUrl(item: NotificationItem): string | null {
  return (item.data?.url as string) || null;
}

export default function UmateHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useMe();
  const isStudio = pathname.startsWith("/umate/account");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);
  const isAuthed = Boolean(me?.user?.id);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);

  useEffect(() => {
    if (!me?.user) return;
    apiFetch<{ creator: any }>("/umate/creator/me")
      .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
      .catch(() => {});
  }, [me]);

  /* Load notifications */
  useEffect(() => {
    if (!isAuthed) { setNotifications([]); return; }
    setLoadingNotifs(true);
    apiFetch<{ notifications: NotificationItem[] }>("/notifications")
      .then((res) => setNotifications(res?.notifications ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotifs(false));
  }, [isAuthed]);

  /* Close bell on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleNotifClick = async (item: NotificationItem) => {
    try {
      await apiFetch(`/notifications/${item.id}/read`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch { /* silent */ }
    const url = notifUrl(item);
    if (url) { setBellOpen(false); router.push(url); }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch { /* silent */ }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/umate/creators?q=${encodeURIComponent(q)}`);
      setMobileSearch(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.04] bg-[#0a0a12]/85 backdrop-blur-2xl backdrop-saturate-[1.8]">
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00aff0]/20 to-transparent" />

      <div className="mx-auto flex h-[56px] max-w-[1170px] items-center justify-between gap-3 px-4">
        {/* Left: Logo + Nav */}
        <div className="flex items-center gap-4">
          <Link href="/umate" className="flex shrink-0 items-center gap-2">
            <img src="/brand/umate-logo-white.svg" alt="U-Mate" className="h-7 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {[
              { href: "/umate", icon: Home, label: "Inicio", exact: true },
              { href: "/umate/explore", icon: Compass, label: "Explorar" },
              ...(isCreator ? [{ href: "/umate/account/creator", icon: Crown, label: "Studio", exact: false }] : []),
            ].map((item) => {
              const active = ("exact" in item && item.exact) ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    active
                      ? "bg-white/[0.06] text-white"
                      : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
                  }`}
                >
                  <item.icon className={`h-4 w-4 ${active ? "text-[#00aff0]" : ""}`} />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Center: Search */}
        <div className="hidden flex-1 justify-center md:flex">
          <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar creadoras..."
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none transition-all duration-300 focus:border-[#00aff0]/30 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(0,175,240,0.06)]"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1">
          {isCreator && me?.user && (
            <Link
              href="/umate/account/content"
              className="hidden items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_16px_rgba(0,175,240,0.3)] transition-all duration-200 hover:shadow-[0_4px_24px_rgba(0,175,240,0.4)] hover:-translate-y-px md:inline-flex"
            >
              <Plus className="h-4 w-4" /> Publicar
            </Link>
          )}

          <button
            onClick={() => setMobileSearch(!mobileSearch)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/[0.06] hover:text-white/70 md:hidden"
          >
            {mobileSearch ? <span className="text-xs font-bold">✕</span> : <Search className="h-5 w-5" />}
          </button>

          <Link
            href="/chats"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
          >
            <MessageCircle className="h-5 w-5" />
          </Link>

          <div className="relative" ref={bellRef}>
            <button
              type="button"
              onClick={() => setBellOpen((prev) => !prev)}
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-[#00aff0] px-1 py-0.5 text-center text-[9px] font-bold leading-none text-white shadow-[0_0_8px_rgba(0,175,240,0.6)]">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-12 w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a12]/95 shadow-[0_18px_48px_rgba(0,0,0,0.5)] backdrop-blur-2xl md:w-[340px]">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <span className="text-sm font-semibold text-white">Notificaciones</span>
                  {unreadCount > 0 && (
                    <button type="button" onClick={handleMarkAllRead} className="text-[11px] font-medium text-[#00aff0] hover:text-[#00aff0]/80 transition">
                      Marcar leídas
                    </button>
                  )}
                </div>
                <div className="max-h-[320px] overflow-y-auto p-2">
                  {loadingNotifs ? (
                    <div className="px-3 py-6 text-center text-sm text-white/40">Cargando…</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-white/40">Sin notificaciones</div>
                  ) : (
                    <div className="space-y-0.5">
                      {notifications.slice(0, 15).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNotifClick(item)}
                          className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                        >
                          <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-white/20" : "bg-[#00aff0] shadow-[0_0_6px_rgba(0,175,240,0.5)]"}`} />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-white/90">{notifLabel(item)}</div>
                            {item.data?.body && <div className="mt-0.5 text-[11px] text-white/35 line-clamp-1">{String(item.data.body)}</div>}
                            <div className="mt-1 text-[10px] text-white/25">{new Date(item.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {me?.user ? (
            <Link
              href="/umate/account"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border-2 transition ${
                isStudio
                  ? "border-[#00aff0]/60 shadow-[0_0_12px_rgba(0,175,240,0.15)]"
                  : "border-white/10 hover:border-white/25"
              }`}
            >
              {me.user.avatarUrl ? (
                <img src={resolveMediaUrl(me.user.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-white/50" />
              )}
            </Link>
          ) : (
            <Link
              href="/login?next=/umate"
              className="rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-4 py-2 text-sm font-semibold text-white transition hover:shadow-[0_4px_20px_rgba(0,175,240,0.3)]"
            >
              Iniciar sesión
            </Link>
          )}

          <Link
            href="/"
            className="hidden items-center gap-1 rounded-xl border border-white/[0.06] px-3 py-2 text-[11px] font-medium text-white/35 transition hover:border-white/15 hover:text-white/50 xl:flex"
          >
            <ArrowLeft className="h-3 w-3" /> UZEED
          </Link>
        </div>
      </div>

      {/* Mobile search overlay */}
      {mobileSearch && (
        <div className="border-t border-white/[0.04] bg-[#0a0a12] px-4 py-3 md:hidden">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar creadoras..."
              autoFocus
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none focus:border-[#00aff0]/30"
            />
          </form>
        </div>
      )}
    </header>
  );
}
