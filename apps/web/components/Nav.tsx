"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Home,
  MessageCircle,
  MessageSquare,
  MapPin,
  User,
  Hotel,
  Camera,
  LayoutDashboard,
  Edit3,
  Wallet,
  Video,
  Radio,
  HelpCircle,
} from "lucide-react";
import useMe from "../hooks/useMe";
import { useForumNotifications } from "./ForumNotifications";
import { useChatNotifications } from "./ChatNotifications";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  protected: boolean;
};

const LIVE_EXTERNAL_URL = "https://live.uzeed.cl/";

const clientItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, protected: false },
  { href: "/servicios", label: "Cerca tuyo", icon: MapPin, protected: false },
  { href: "/videocall", label: "Videollamadas", icon: Video, protected: false },
  { href: LIVE_EXTERNAL_URL, label: "En Vivo", icon: Radio, protected: false },
  { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/foro", label: "Foro", icon: MessageSquare, protected: false },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: false },
];

const motelItems: NavItem[] = [
  { href: "/dashboard/motel", label: "Dashboard", icon: Hotel, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: true },
];

/* Bottom bar shows max 5 items on mobile – "En Vivo" is a key feature */
const mobileClientItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, protected: false },
  { href: LIVE_EXTERNAL_URL, label: "En Vivo", icon: Radio, protected: false },
  { href: "/servicios", label: "Cerca", icon: MapPin, protected: false },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: false },
];

export default function Nav() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);
  const { badgeCount } = useForumNotifications();
  const { unreadCount: chatUnread } = useChatNotifications();

  const role = String(me?.user?.role || "").toUpperCase();
  const ptype = String(me?.user?.profileType || "").toUpperCase();
  const isMotelProfile = ptype === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
  const isProfessional = ptype === "PROFESSIONAL";
  const isShop = ptype === "SHOP";
  const hasProfile = isProfessional || isShop;

  /* Desktop sidebar items */
  const sidebarItems: NavItem[] = isMotelProfile
    ? motelItems
    : clientItems;

  /* Professional extra items for sidebar */
  const profileItems: NavItem[] = hasProfile
    ? [
        { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, protected: true },
        { href: "/dashboard/services", label: "Editar perfil", icon: Edit3, protected: true },
        ...(isProfessional ? [
          { href: "/dashboard/stories", label: "Subir story", icon: Camera, protected: true },
        ] : []),
        { href: "/wallet", label: "Billetera", icon: Wallet, protected: true },
      ]
    : isAuthed
      ? [{ href: "/wallet", label: "Billetera", icon: Wallet, protected: true }]
      : [];

  /* Mobile bottom items */
  const mobileItems: NavItem[] = isMotelProfile ? motelItems : mobileClientItems;

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex h-screen sticky top-0 w-[240px] shrink-0 flex-col border-r border-white/[0.07] bg-[#08090f]/80 backdrop-blur-2xl">
        {/* Subtle gradient glow at top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-fuchsia-500/[0.04] to-transparent" />

        <div className="px-5 py-4" />
        <nav className="relative flex-1 px-3 space-y-1">
          {/* Main navigation */}
          <div className="space-y-0.5">
            {sidebarItems.map((item) => {
              const isExternal = item.href.startsWith("http");
              const active = isExternal
                ? false
                : item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              const isLive = item.label === "En Vivo";
              const href = item.protected && !isAuthed && !isExternal
                ? `/login?next=${encodeURIComponent(item.href)}`
                : item.href;
              const className = `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-fuchsia-500/[0.12] to-violet-500/[0.06] border border-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.08)]"
                  : "text-white/70 hover:bg-white/[0.04] hover:text-white/90"
              }`;
              const inner = (
                <>
                  <Icon className={`h-4 w-4 transition-colors ${active ? "text-fuchsia-400" : "group-hover:text-fuchsia-400/60"}`} />
                  {item.label}
                  {/* Live pulse dot */}
                  {isLive && (
                    <span className="relative ml-0.5 flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
                    </span>
                  )}
                  {item.href === "/foro" && badgeCount > 0 && (
                    <span className="ml-auto min-w-[18px] rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-[0_0_8px_rgba(217,70,239,0.5)]">
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </span>
                  )}
                  {item.href === "/chats" && chatUnread > 0 && (
                    <span className="ml-auto min-w-[18px] rounded-full bg-fuchsia-500 px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-white shadow-[0_0_8px_rgba(217,70,239,0.5)]">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </>
              );
              return isExternal ? (
                <a key={item.href} href={href} className={className}>
                  {inner}
                </a>
              ) : (
                <Link key={item.href} href={href} className={className}>
                  {inner}
                </Link>
              );
            })}
          </div>

          {/* Profile section */}
          {profileItems.length > 0 && (
            <div className="pt-3 mt-3 border-t border-white/[0.06]">
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                {hasProfile ? "Mi perfil" : "Mi cuenta"}
              </p>
              {profileItems.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                const href = item.protected && !isAuthed
                  ? `/login?next=${encodeURIComponent(item.href)}`
                  : item.href;
                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      active
                        ? "bg-gradient-to-r from-fuchsia-500/[0.12] to-violet-500/[0.06] border border-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.08)]"
                        : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
                    }`}
                  >
                    <Icon className={`h-4 w-4 transition-colors ${active ? "text-fuchsia-400" : "group-hover:text-fuchsia-400/60"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Soporte section */}
          <div className="pt-3 mt-3 border-t border-white/[0.06]">
            <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
              Soporte
            </p>
            <Link
              href="/ayuda"
              className={`group flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                pathname === "/ayuda" || pathname.startsWith("/ayuda/")
                  ? "bg-gradient-to-r from-fuchsia-500/[0.12] to-violet-500/[0.06] border border-fuchsia-500/20 text-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,0.08)]"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              <HelpCircle
                className={`h-4 w-4 transition-colors ${
                  pathname === "/ayuda" || pathname.startsWith("/ayuda/")
                    ? "text-fuchsia-400"
                    : "group-hover:text-fuchsia-400/60"
                }`}
              />
              Ayuda
            </Link>
          </div>
        </nav>

        {/* Sidebar footer with subtle branding */}
        <div className="border-t border-white/[0.05] p-4">
          <div className="flex items-center gap-2 text-[11px] text-white/25">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent" />
            <span className="font-medium tracking-wide">UZEED</span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500/20 to-transparent" />
          </div>
        </div>
      </aside>

      {/* ── Mobile Bottom Bar ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#08090f]/95 backdrop-blur-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Top glow line */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-500/25 to-transparent" />

        <div
          className="mx-auto grid max-w-[520px] px-1 py-1"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
            const isExternal = item.href.startsWith("http");
            const active = isExternal
              ? false
              : item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            const isLive = item.label === "En Vivo";
            const href = item.protected && !isAuthed && !isExternal
              ? `/login?next=${encodeURIComponent(item.href)}`
              : item.href;
            const inner = (
              <>
                <div className={`relative rounded-xl p-1.5 transition-all duration-200 ${active ? "bg-gradient-to-br from-fuchsia-500/20 to-violet-500/10 shadow-[0_0_12px_rgba(217,70,239,0.15)]" : ""}`}>
                  <Icon className={`h-5 w-5 transition-colors ${active ? "text-fuchsia-400" : "text-white/45"}`} />
                  {/* Live pulse indicator */}
                  {isLive && !active && (
                    <span className="absolute -right-2 -top-1.5 inline-flex items-center justify-center rounded-full bg-red-500 px-1 py-[1px] text-[8px] font-extrabold leading-none text-white shadow-[0_0_6px_rgba(239,68,68,0.7)] ring-1 ring-red-300/50 animate-pulse">
                      +15
                    </span>
                  )}
                  {item.href === "/chats" && chatUnread > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-fuchsia-500 px-1 py-[1px] text-center text-[9px] font-bold leading-none text-white shadow-[0_0_8px_rgba(217,70,239,0.6)]">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </div>
                <span className={`transition-colors ${active ? "text-fuchsia-300 font-semibold" : "text-white/45"}`}>
                  {item.label}
                </span>
              </>
            );
            const className = "flex flex-col items-center gap-0.5 py-2 text-[10px] transition-all duration-200";
            return isExternal ? (
              <a key={item.href} href={href} className={className}>
                {inner}
              </a>
            ) : (
              <Link key={item.href} href={href} className={className}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
