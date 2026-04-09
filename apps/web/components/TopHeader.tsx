"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  MapPin,
  Navigation,
  Menu,
  X,
  Home,
  Heart,
  MessageCircle,
  MessageSquare,
  User,
  Sparkles,
  HandMetal,
  Building2,
  ShoppingBag,
  PartyPopper,
  Video,
  Radio,
  LayoutDashboard,
  Camera,
  Settings,
  LogIn,
  Search,
  Crown,
  Wallet,
} from "lucide-react";
import Avatar from "./Avatar";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";
import { connectRealtime } from "../lib/realtime";
import { CHILEAN_CITIES, LocationFilterContext } from "../hooks/useLocationFilter";
import { useForumNotifications } from "./ForumNotifications";

type NotificationItem = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

function notificationLabel(item: NotificationItem): string {
  // Use title from data if available (set by sendInAppAndPush)
  if (item.data?.title && typeof item.data.title === "string") return item.data.title;
  switch (item.type) {
    case "MESSAGE_RECEIVED":            return "Tienes un mensaje nuevo";
    case "SERVICE_PUBLISHED":           return (item.data?.title as string) || "Solicitud de servicio";
    case "POST_PUBLISHED":              return "Hay una actualización reciente";
    case "SUBSCRIPTION_STARTED":        return "Tu suscripción fue activada";
    case "SUBSCRIPTION_RENEWED":        return "Tu suscripción fue renovada";
    case "FORUM_REPLY":                 return "Nueva respuesta en el foro";
    case "FORUM_NEW_THREAD":            return "Nuevo hilo en el foro";
    case "BOOKING_UPDATE":              return "Actualización de reserva";
    case "REMINDER_NO_PHOTO":           return "¡Sube tu primera foto!";
    case "REMINDER_INACTIVE":           return "Te extrañamos en UZEED";
    case "REMINDER_VIDEOCALL_CONFIG":   return "Configura tus videollamadas";
    case "VIDEOCALL_BOOKED":            return "Nueva videollamada agendada";
    case "SERVICE_REQUEST_NEW":         return "Nueva solicitud de encuentro";
    default:                            return "Nueva notificación";
  }
}

function notificationUrl(item: NotificationItem): string | null {
  const url = item.data?.url as string | undefined;
  if (url) return url;
  switch (item.type) {
    case "MESSAGE_RECEIVED": {
      const fromId = item.data?.fromId as string | undefined;
      return fromId ? `/chat/${fromId}` : "/chat";
    }
    case "SERVICE_PUBLISHED":           return "/dashboard/services";
    case "POST_PUBLISHED":              return "/";
    case "FORUM_REPLY":
    case "FORUM_NEW_THREAD": {
      const threadId = item.data?.threadId as string | undefined;
      return threadId ? `/foro/thread/${threadId}` : "/foro";
    }
    case "SUBSCRIPTION_STARTED":
    case "SUBSCRIPTION_RENEWED":        return "/cuenta";
    case "BOOKING_UPDATE":              return "/dashboard/motel";
    case "REMINDER_NO_PHOTO":           return "/dashboard/services";
    case "REMINDER_INACTIVE":           return "/";
    case "REMINDER_VIDEOCALL_CONFIG":   return "/videocall";
    case "VIDEOCALL_BOOKED":            return "/videocall";
    case "SERVICE_REQUEST_NEW":         return "/dashboard/services";
    default:                            return null;
  }
}

function notificationTime(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit",
  }).format(new Date(iso));
}

/* ── Category menu data ─────────────────────────────────── */
const MEGA_MENU = [
  { label: "Escorts", route: "/escorts", icon: Sparkles },
  { label: "Masajistas", route: "/masajistas", icon: HandMetal },
  { label: "Creadoras", route: "/creadoras", icon: Camera },
  { label: "Moteles", route: "/moteles", icon: Building2 },
  { label: "Sex Shop", route: "/sexshop", icon: ShoppingBag },
  { label: "Despedidas", route: "/escorts?serviceTags=despedidas", icon: PartyPopper },
  { label: "Videollamadas", route: "/videocall", icon: Video },
  { label: "Premium", route: "/premium", icon: Crown },
] as const;

export default function TopHeader() {
  const { me } = useMe();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const isAuthed = Boolean(me?.user?.id);

  const [panelOpen, setPanelOpen]       = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const panelRef    = useRef<HTMLDivElement | null>(null);
  const locationRef = useRef<HTMLDivElement | null>(null);

  const locationFilter = useContext(LocationFilterContext);

  const { badgeCount: forumBadge } = useForumNotifications();
  const isProfessional = (me?.user?.profileType ?? "").toUpperCase() === "PROFESSIONAL";
  const isEstablishment = (me?.user?.profileType ?? "").toUpperCase() === "ESTABLISHMENT";
  const isShop = (me?.user?.profileType ?? "").toUpperCase() === "SHOP";
  const hasProfile = isProfessional || isEstablishment || isShop;

  /* ── Load notifications ── */
  useEffect(() => {
    if (!isAuthed) { setNotifications([]); return; }
    setLoadingNotifications(true);
    apiFetch<{ notifications: NotificationItem[] }>("/notifications")
      .then((res) => setNotifications(res?.notifications ?? []))
      .catch(() => setNotifications([]))
      .finally(() => setLoadingNotifications(false));
  }, [isAuthed]);

  /* ── Real-time notification updates via SSE ── */
  useEffect(() => {
    if (!isAuthed) return;
    const cleanup = connectRealtime((event) => {
      // Listen for notification events pushed by the server
      if (event.type === "notification" && event.data) {
        const n = event.data as NotificationItem;
        if (n.id) {
          setNotifications((prev) => {
            if (prev.some((p) => p.id === n.id)) return prev;
            return [n, ...prev];
          });
        }
      }
    });
    return cleanup;
  }, [isAuthed]);

  /* ── Close dropdowns on outside click ── */
  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node))
        setPanelOpen(false);
      if (locationRef.current && !locationRef.current.contains(event.target as Node))
        setLocationOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  /* ── Lock body scroll when hamburger open ── */
  useEffect(() => {
    if (hamburgerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [hamburgerOpen]);

  const unreadCount  = useMemo(() => notifications.filter((n) => !n.readAt).length, [notifications]);
  const recentItems  = notifications.slice(0, 15);

  const handleNotificationClick = async (item: NotificationItem) => {
    try {
      await apiFetch<{ ok: boolean }>(`/notifications/${item.id}/read`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch { /* silent */ }
    const url = notificationUrl(item);
    if (url) {
      setPanelOpen(false);
      router.push(url);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch<{ ok: boolean }>("/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
    } catch { /* silent */ }
  };

  const [deleting, setDeleting] = useState(false);
  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      await apiFetch<{ ok: boolean }>("/notifications/delete-all", { method: "POST" });
      setNotifications([]);
      setPanelOpen(false);
    } catch { /* silent */ }
    setDeleting(false);
  };

  const locationLabel =
    locationFilter?.state.mode === "city" && locationFilter.state.selectedCity
      ? locationFilter.state.selectedCity.name
      : "Mi ubicación";

  const handleCategoryClick = (route: string) => {
    router.push(route);
    setHamburgerOpen(false);
  };

  const handleNavLink = (href: string) => {
    router.push(href);
    setHamburgerOpen(false);
  };

  const isCategoryActive = (route: string) => {
    const base = route.split("?")[0];
    return pathname.startsWith(base);
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 md:left-[240px]">
        <div className="w-full bg-gradient-to-b from-[#0d0e1a] to-[#0d0e1a]/90 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.3)]">

          {/* ── Main row ── */}
          <div className="px-3 py-2.5 md:px-5 md:py-3">
            <div className="flex items-center justify-between">

              {/* Left: Hamburger (mobile) + Logo */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setHamburgerOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-600/20 to-violet-600/20 border border-fuchsia-500/20 text-white transition hover:from-fuchsia-600/30 hover:to-violet-600/30 md:hidden"
                  aria-label="Abrir menú"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <Link href="/" className="flex items-center gap-2.5">
                  <Image
                    src="/brand/isotipo-new.png"
                    alt="UZEED - Escorts y Acompañantes en Chile"
                    width={48}
                    height={48}
                    priority
                    className="h-10 w-10 object-contain drop-shadow-[0_4px_12px_rgba(168,85,247,0.4)] md:h-12 md:w-12"
                  />
                  <span className="text-2xl font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_8px_rgba(168,85,247,0.3)] md:text-3xl">
                    Uzeed
                  </span>
                </Link>
              </div>

              {/* Center: Desktop category navigation only */}
              <nav className="hidden md:flex items-center gap-1">
                <Link
                  href="/"
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${pathname === "/" ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25" : "text-white/60 hover:bg-white/10 hover:text-white/90"}`}
                >
                  Inicio
                </Link>
                {MEGA_MENU.map((item) => (
                  <Link
                    key={item.route}
                    href={item.route}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${isCategoryActive(item.route) ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25" : "text-white/60 hover:bg-white/10 hover:text-white/90"}`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/servicios"
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${pathname.startsWith("/servicios") || pathname.startsWith("/services") ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25" : "text-white/60 hover:bg-white/10 hover:text-white/90"}`}
                >
                  Cerca tuyo
                </Link>
                <Link
                  href="/foro"
                  className={`relative rounded-full px-3 py-1.5 text-xs font-medium transition ${pathname.startsWith("/foro") ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25" : "text-white/60 hover:bg-white/10 hover:text-white/90"}`}
                >
                  Foro
                  {forumBadge > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-fuchsia-500 px-1 py-[1px] text-center text-[9px] font-bold leading-none text-white shadow-[0_0_8px_rgba(217,70,239,0.6)]">
                      {forumBadge > 9 ? "9+" : forumBadge}
                    </span>
                  )}
                </Link>
              </nav>

              {/* Right: Location + Notifications + Avatar */}
              <div className="flex items-center gap-2">
                {/* Location chip */}
                <div className="relative" ref={locationRef}>
                  <button
                    type="button"
                    onClick={() => setLocationOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600/20 to-violet-600/15 border border-fuchsia-500/30 px-3 py-2 text-xs font-semibold text-white transition hover:from-fuchsia-600/30 hover:to-violet-600/25 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                  >
                    <MapPin className="h-3.5 w-3.5 text-fuchsia-400" />
                    <span className="max-w-[100px] truncate">{locationLabel}</span>
                  </button>

                  {locationOpen && (
                    <div className="absolute right-0 top-12 z-50 w-[280px] overflow-hidden rounded-2xl border border-white/15 bg-[#0a0b1de6] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:w-[320px]">
                      <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Ubicación</div>
                      <div className="max-h-[380px] overflow-y-auto p-2">
                        <button
                          type="button"
                          onClick={() => { locationFilter?.useCurrentLocation(); setLocationOpen(false); }}
                          className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition hover:bg-white/10 ${locationFilter?.state.mode === "gps" ? "bg-fuchsia-500/10 text-fuchsia-200" : "text-white/80"}`}
                        >
                          <Navigation className="h-4 w-4 text-fuchsia-400" />
                          <div>
                            <div className="font-medium">Usar ubicación actual</div>
                            <div className="text-[11px] text-white/50">GPS del dispositivo</div>
                          </div>
                        </button>
                        <div className="my-2 border-t border-white/[0.06]" />
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          Ciudades de Chile
                        </div>
                        {CHILEAN_CITIES.map((city) => (
                          <button
                            key={city.name}
                            type="button"
                            onClick={() => { locationFilter?.setCity(city); setLocationOpen(false); }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/10 ${locationFilter?.state.selectedCity?.name === city.name ? "bg-fuchsia-500/10 text-fuchsia-200" : "text-white/80"}`}
                          >
                            <MapPin className="h-3.5 w-3.5 text-white/40" />
                            <div>
                              <div className="font-medium">{city.name}</div>
                              <div className="text-[10px] text-white/40">{city.region}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                {isAuthed && (
                  <div className="relative" ref={panelRef}>
                    <button
                      type="button"
                      onClick={() => setPanelOpen((prev) => !prev)}
                      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-white transition hover:bg-white/10"
                      aria-label="Abrir notificaciones"
                    >
                      <Bell className={`h-5 w-5 ${unreadCount > 0 ? "animate-[bellRing_2s_ease-in-out_infinite]" : ""}`} />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-[0_0_12px_rgba(217,70,239,0.7)]">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {panelOpen && (
                      <div className="absolute right-0 top-14 w-[300px] overflow-hidden rounded-2xl border border-white/15 bg-[#0a0b1de6] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:w-[340px]">
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                          <span className="text-sm font-semibold">Notificaciones</span>
                          <div className="flex gap-2">
                            {unreadCount > 0 && (
                              <button
                                type="button"
                                onClick={handleMarkAllRead}
                                className="text-[11px] text-fuchsia-400 hover:text-fuchsia-300 transition font-medium"
                              >
                                Marcar leídas
                              </button>
                            )}
                            {recentItems.length > 0 && (
                              <button
                                type="button"
                                onClick={handleDeleteAll}
                                disabled={deleting}
                                className="text-[11px] text-red-400 hover:text-red-300 transition font-medium disabled:opacity-50"
                              >
                                {deleting ? "Borrando…" : "Borrar todas"}
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="max-h-[320px] overflow-y-auto p-2">
                          {loadingNotifications ? (
                            <div className="px-3 py-4 text-sm text-white/70">Cargando…</div>
                          ) : recentItems.length ? (
                            <div className="space-y-1">
                              {recentItems.map((item) => {
                                const hasLink = !!notificationUrl(item);
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleNotificationClick(item)}
                                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/10 ${hasLink ? "cursor-pointer" : ""}`}
                                  >
                                    <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.readAt ? "bg-white/30" : "bg-fuchsia-400 shadow-[0_0_6px_rgba(217,70,239,0.5)]"}`} />
                                    <div className="min-w-0 flex-1">
                                      <div className="text-sm text-white/95">{notificationLabel(item)}</div>
                                      {item.data?.body ? (
                                        <div className="mt-0.5 text-[11px] text-white/45 line-clamp-1">{String(item.data.body)}</div>
                                      ) : null}
                                      <div className="mt-1 text-[10px] text-white/40">{notificationTime(item.createdAt)}</div>
                                    </div>
                                    {hasLink && (
                                      <svg className="mt-1.5 h-3.5 w-3.5 shrink-0 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="px-3 py-4 text-sm text-white/65">No tienes notificaciones recientes.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Avatar */}
                <Link
                  href={isAuthed ? "/cuenta" : "/login?next=%2Fcuenta"}
                  className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.06] p-1 transition hover:bg-white/10"
                >
                  <Avatar src={me?.user?.avatarUrl} alt="Cuenta" size={34} className="border-white/20" />
                </Link>
              </div>
            </div>
          </div>

          {/* Gradient bottom line */}
          <div className="h-px bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
          <div className="h-px bg-gradient-to-r from-transparent via-violet-500/15 to-transparent" />
        </div>
      </header>

      {/* ── Hamburger Menu Overlay (mobile) ── */}
      {hamburgerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setHamburgerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-[#0a0b1d]/95 backdrop-blur-2xl border-r border-white/[0.08] overflow-y-auto animate-[slideInLeft_0.2s_ease-out]">
            {/* Decorative gradient */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-fuchsia-500/[0.06] to-transparent" />

            <div className="relative flex items-center justify-between border-b border-white/[0.08] px-4 py-4">
              <div className="flex items-center gap-2">
                <Image src="/brand/isotipo-new.png" alt="UZEED" width={40} height={40} className="h-10 w-10 object-contain drop-shadow-[0_2px_8px_rgba(168,85,247,0.3)]" />
                <span className="text-xl font-bold text-white tracking-tight">Uzeed</span>
              </div>
              <button
                type="button"
                onClick={() => setHamburgerOpen(false)}
                className="rounded-xl p-2 text-white/60 hover:bg-white/10 transition"
                aria-label="Cerrar menú"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isAuthed && me?.user && (
              <div className="border-b border-white/[0.06] px-4 py-4">
                <div className="flex items-center gap-3">
                  <Avatar src={me.user.avatarUrl} alt="Perfil" size={40} className="border-white/20" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">{me.user.username}</div>
                    <div className="text-[11px] text-white/40 capitalize">{(me.user.profileType || "").toLowerCase()}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="relative py-3">
              {/* Quick access – compact icon grid for categories */}
              <div className="px-4 pb-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">Explorar</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {MEGA_MENU.map((item) => {
                    const Icon = item.icon;
                    const isActive = isCategoryActive(item.route);
                    return (
                      <button
                        key={item.route}
                        onClick={() => handleCategoryClick(item.route)}
                        className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[10px] transition-all ${isActive ? "bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20" : "text-white/60 hover:bg-white/[0.06] border border-transparent"}`}
                      >
                        <Icon className={`h-4 w-4 ${isActive ? "text-fuchsia-400" : "text-fuchsia-400/60"}`} />
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              {/* Main nav links – condensed */}
              <div className="px-3 pt-3 pb-1 space-y-0.5">
                <button onClick={() => handleNavLink("/")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                  <Home className="h-4 w-4 text-white/40" /> Inicio
                </button>
                <button onClick={() => handleNavLink("/servicios")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                  <Search className="h-4 w-4 text-white/40" /> Cerca tuyo
                </button>
                <button onClick={() => handleNavLink("/live")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                  <Radio className="h-4 w-4 text-red-400/80" />
                  En Vivo
                  <span className="relative ml-0.5 flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                </button>
                <button onClick={() => handleNavLink("/foro")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                  <MessageSquare className="h-4 w-4 text-white/40" /> Foro
                  {forumBadge > 0 && (
                    <span className="ml-auto min-w-[18px] rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white">
                      {forumBadge > 9 ? "9+" : forumBadge}
                    </span>
                  )}
                </button>
                {isAuthed && (
                  <>
                    <button onClick={() => handleNavLink("/chats")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <MessageCircle className="h-4 w-4 text-white/40" /> Mensajes
                    </button>
                    <button onClick={() => handleNavLink("/favoritos")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <Heart className="h-4 w-4 text-white/40" /> Favoritos
                    </button>
                  </>
                )}
              </div>

              {isAuthed && hasProfile && (
                <>
                  <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                  <div className="px-3 pt-3 pb-1 space-y-0.5">
                    <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/25">Mi perfil</p>
                    <button onClick={() => handleNavLink("/dashboard")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <LayoutDashboard className="h-4 w-4 text-white/40" /> Dashboard
                    </button>
                    <button onClick={() => handleNavLink("/dashboard/services")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <Settings className="h-4 w-4 text-white/40" /> Editar perfil
                    </button>
                    {isProfessional && (
                      <button onClick={() => handleNavLink("/dashboard/stories")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                        <Camera className="h-4 w-4 text-white/40" /> Subir story
                      </button>
                    )}
                  </div>
                </>
              )}

              <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

              {/* Account section */}
              <div className="px-3 pt-3 pb-1 space-y-0.5">
                {isAuthed ? (
                  <>
                    <button onClick={() => handleNavLink("/cuenta")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <User className="h-4 w-4 text-white/40" /> Mi cuenta
                    </button>
                    <button onClick={() => handleNavLink("/wallet")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <Wallet className="h-4 w-4 text-white/40" /> Billetera
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleNavLink("/login")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.06] transition">
                      <LogIn className="h-4 w-4 text-white/40" /> Iniciar sesión
                    </button>
                    <button onClick={() => handleNavLink("/register")} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 mx-1 mt-1 px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">
                      <Sparkles className="h-4 w-4" /> Crear cuenta
                    </button>
                  </>
                )}
              </div>
              {/* Hamburger footer */}
              <div className="relative mt-4 border-t border-white/[0.05] px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] text-white/20">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500/15 to-transparent" />
                  <span className="font-medium tracking-widest">UZEED</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500/15 to-transparent" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
