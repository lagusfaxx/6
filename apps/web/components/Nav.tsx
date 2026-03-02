"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  Home,
  MessageCircle,
  MapPin,
  User,
  Hotel,
  Camera,
  LayoutDashboard,
  Edit3,
  Settings,
} from "lucide-react";
import useMe from "../hooks/useMe";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  protected: boolean;
};

const clientItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, protected: false },
  { href: "/servicios", label: "Cerca tuyo", icon: MapPin, protected: false },
  { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: false },
];

const motelItems: NavItem[] = [
  { href: "/dashboard/motel", label: "Dashboard", icon: Hotel, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: true },
];

/* Bottom bar shows max 5 items on mobile */
const mobileClientItems: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, protected: false },
  { href: "/servicios", label: "Cerca", icon: MapPin, protected: false },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: false },
];

export default function Nav() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

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
        ...(isProfessional ? [{ href: "/dashboard/stories", label: "Subir story", icon: Camera, protected: true }] : []),
      ]
    : [];

  /* Mobile bottom items */
  const mobileItems: NavItem[] = isMotelProfile ? motelItems : mobileClientItems;

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex h-screen sticky top-0 w-[240px] shrink-0 flex-col border-r border-white/10 bg-black/40 backdrop-blur">
        <div className="px-5 py-4" />
        <nav className="flex-1 px-3 space-y-1">
          {/* Main navigation */}
          <div className="space-y-0.5">
            {sidebarItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              const href = item.protected && !isAuthed
                ? `/login?next=${encodeURIComponent(item.href)}`
                : item.href;
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active
                      ? "bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-200"
                      : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-fuchsia-400" : ""}`} />
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Profile section for professionals */}
          {profileItems.length > 0 && (
            <div className="pt-3 mt-3 border-t border-white/[0.06]">
              <p className="px-4 mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                Mi perfil
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
                    className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                      active
                        ? "bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-200"
                        : "text-white/60 hover:bg-white/5 hover:text-white/80"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-fuchsia-400" : ""}`} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className="p-4 text-[11px] text-white/30">
          Encuentra profesionales y establecimientos confiables.
        </div>
      </aside>

      {/* ── Mobile Bottom Bar ── */}
      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#08090f]/90 backdrop-blur-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div
          className="mx-auto grid max-w-[520px] px-2 py-1.5"
          style={{ gridTemplateColumns: `repeat(${mobileItems.length}, minmax(0, 1fr))` }}
        >
          {mobileItems.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            const href = item.protected && !isAuthed
              ? `/login?next=${encodeURIComponent(item.href)}`
              : item.href;
            return (
              <Link
                key={item.href}
                href={href}
                className="flex flex-col items-center gap-0.5 py-2 text-[10px] transition"
              >
                <div className={`rounded-xl p-1.5 transition ${active ? "bg-fuchsia-500/15" : ""}`}>
                  <Icon className={`h-5 w-5 ${active ? "text-fuchsia-400" : "text-white/45"}`} />
                </div>
                <span className={`${active ? "text-fuchsia-300 font-medium" : "text-white/45"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
