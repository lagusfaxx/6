"use client";

import Link from "next/link";
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
  User,
  Sparkles,
  HandMetal,
  Building2,
  ShoppingBag,
  PartyPopper,
  Video,
  LayoutDashboard,
  Camera,
  Settings,
  LogIn,
  Search,
} from "lucide-react";
import Avatar from "./Avatar";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";
import { CHILEAN_CITIES, LocationFilterContext } from "../hooks/useLocationFilter";

type NotificationItem = {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  readAt?: string | null;
  createdAt: string;
};

function notificationLabel(item: NotificationItem): string {
  switch (item.type) {
    case "MESSAGE_RECEIVED":      return "Tienes un mensaje nuevo";
    case "SERVICE_PUBLISHED":     return "Se publicó una solicitud de servicio";
    case "POST_PUBLISHED":        return "Hay una actualización reciente";
    case "SUBSCRIPTION_STARTED":  return "Tu suscripción fue activada";
    case "SUBSCRIPTION_RENEWED":  return "Tu suscripción fue renovada";
    default:                      return "Nueva notificación";
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
  { label: "Moteles", route: "/moteles", icon: Building2 },
  { label: "Sex Shop", route: "/sexshop", icon: ShoppingBag },
  { label: "Despedidas", route: "/escorts?serviceTags=despedidas", icon: PartyPopper },
  { label: "Videollamadas", route: "/escorts?serviceTags=videollamadas", icon: Video },
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
  const recentItems  = notifications.slice(0, 5);

  const markAsRead = async (id: string) => {
    try {
      await apiFetch<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
    } catch { /* silent */ }
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
        <div className="w-full bg-gradient-to-b from-[#0d0e1a] to-[#0d0e1a]/95 backdrop-blur-xl">

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
                  <img
                    src="/brand/isotipo-new.png"
                    alt="UZEED"
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
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-[0_0_12px_rgba(217,70,239,0.7)]">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {panelOpen && (
                      <div className="absolute right-0 top-14 w-[300px] overflow-hidden rounded-2xl border border-white/15 bg-[#0a0b1de6] shadow-[0_18px_48px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:w-[340px]">
                        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">Notificaciones</div>
                        <div className="max-h-[320px] overflow-y-auto p-2">
                          {loadingNotifications ? (
                            <div className="px-3 py-4 text-sm text-white/70">Cargando…</div>
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
          <div className="h-[1px] bg-gradient-to-r from-transparent via-fuchsia-500/30 to-transparent" />
        </div>
      </header>

      {/* ── Hamburger Menu Overlay (mobile) ── */}
      {hamburgerOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setHamburgerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-[#0a0b1d] border-r border-white/10 overflow-y-auto animate-[slideInLeft_0.2s_ease-out]">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-2">
                <img src="/brand/isotipo-new.png" alt="UZEED" className="h-10 w-10 object-contain" />
                <span className="text-xl font-bold text-white">Uzeed</span>
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

            <div className="py-2">
              <div className="px-3 py-2">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Navegación</p>
                <button onClick={() => handleNavLink("/")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                  <Home className="h-4 w-4 text-white/50" /> Inicio
                </button>
                <button onClick={() => handleNavLink("/servicios")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                  <Search className="h-4 w-4 text-white/50" /> Cerca tuyo
                </button>
                {isAuthed && (
                  <>
                    <button onClick={() => handleNavLink("/favoritos")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                      <Heart className="h-4 w-4 text-white/50" /> Favoritos
                    </button>
                    <button onClick={() => handleNavLink("/chats")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                      <MessageCircle className="h-4 w-4 text-white/50" /> Mensajes
                    </button>
                  </>
                )}
              </div>

              <div className="px-3 py-2">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Categorías</p>
                {MEGA_MENU.map((item) => {
                  const Icon = item.icon;
                  const isActive = isCategoryActive(item.route);
                  return (
                    <button
                      key={item.route}
                      onClick={() => handleCategoryClick(item.route)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? "bg-fuchsia-500/10 text-fuchsia-300" : "text-white/80 hover:bg-white/10"}`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? "text-fuchsia-400" : "text-fuchsia-400/70"}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {isAuthed && hasProfile && (
                <div className="px-3 py-2">
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Mi perfil</p>
                  <button onClick={() => handleNavLink("/dashboard")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                    <LayoutDashboard className="h-4 w-4 text-white/50" /> Dashboard
                  </button>
                  <button onClick={() => handleNavLink("/dashboard/services")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                    <Settings className="h-4 w-4 text-white/50" /> Editar perfil
                  </button>
                  {isProfessional && (
                    <button onClick={() => handleNavLink("/dashboard/stories")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                      <Camera className="h-4 w-4 text-white/50" /> Subir story
                    </button>
                  )}
                </div>
              )}

              <div className="px-3 py-2">
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Cuenta</p>
                {isAuthed ? (
                  <button onClick={() => handleNavLink("/cuenta")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                    <User className="h-4 w-4 text-white/50" /> Mi cuenta
                  </button>
                ) : (
                  <>
                    <button onClick={() => handleNavLink("/login")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/80 hover:bg-white/10 transition">
                      <LogIn className="h-4 w-4 text-white/50" /> Iniciar sesión
                    </button>
                    <button onClick={() => handleNavLink("/register")} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fuchsia-300 hover:bg-fuchsia-500/10 transition">
                      <Sparkles className="h-4 w-4 text-fuchsia-400" /> Crear cuenta
                    </button>
                  </>
                )}
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
