"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Heart,
  Home,
  Hotel,
  MapPin,
  MessageCircle,
  PlusCircle,
  SlidersHorizontal,
  User,
} from "lucide-react";
import useMe from "../hooks/useMe";
import { apiFetch } from "../lib/api";

type InboxConversation = { unreadCount: number };

type BaseItem = {
  href: string;
  label: string;
  icon: any;
  protected: boolean;
  badge?: number;
  iconClassName?: string;
};

function resolveTierLabel(rawTier?: string | null) {
  const tier = String(rawTier || "").toUpperCase();
  if (tier === "PREMIUM") return { label: "Platinum", className: "text-cyan-200 bg-cyan-500/20 border-cyan-300/30" };
  if (tier === "GOLD") return { label: "Gold", className: "text-amber-100 bg-amber-500/20 border-amber-300/30" };
  return { label: "Silver", className: "text-slate-100 bg-slate-500/20 border-slate-300/30" };
}

export default function Nav() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const role = String(me?.user?.role || "").toUpperCase();
  const ptype = String(me?.user?.profileType || "").toUpperCase();
  const isBusiness = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(ptype);
  const isClientOrGuest = !isAuthed || ["CLIENT", "VIEWER", ""].includes(ptype);
  const isMotelProfile = ptype === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";

  const [unreadChats, setUnreadChats] = useState(0);
  const [detectedLocation, setDetectedLocation] = useState<string>("");

  useEffect(() => {
    if (!isAuthed) {
      setUnreadChats(0);
      return;
    }

    let alive = true;
    const load = () => {
      apiFetch<{ conversations: InboxConversation[] }>("/messages/inbox")
        .then((res) => {
          if (!alive) return;
          const total = (res?.conversations || []).reduce((acc, c) => acc + Number(c.unreadCount || 0), 0);
          setUnreadChats(total);
        })
        .catch(() => {
          if (alive) setUnreadChats(0);
        });
    };

    load();
    const timer = setInterval(load, 25000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isAuthed]);

  useEffect(() => {
    const preferred = me?.user?.city || me?.user?.address || "";
    if (preferred) {
      setDetectedLocation(preferred);
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setDetectedLocation("Ubicación no detectada");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => setDetectedLocation("Ubicación detectada · radio 4 km"),
      () => setDetectedLocation("Ubicación no detectada"),
      { timeout: 4500 },
    );
  }, [me?.user?.city, me?.user?.address]);

  const tierInfo = resolveTierLabel((me?.user as any)?.tier);

  const desktopItems: BaseItem[] = useMemo(() => {
    const base: BaseItem[] = isMotelProfile
      ? [
          { href: "/dashboard/motel", label: "Dashboard", icon: Hotel, protected: true },
          { href: "/chats", label: "Chat", icon: MessageCircle, protected: true, badge: unreadChats },
        ]
      : [
          { href: "/", label: "Home", icon: Home, protected: false },
          { href: "/services?view=map&near=1&radiusKm=4", label: "Cerca tuyo", icon: MapPin, protected: false },
          { href: "/services?filters=1", label: "Filtros Pro", icon: SlidersHorizontal, protected: false },
          { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
          { href: "/chats", label: "Chat", icon: MessageCircle, protected: true, badge: unreadChats },
          { href: "/cuenta", label: "Cuenta", icon: User, protected: false },
        ];

    if (isBusiness) {
      base.splice(5, 0, {
        href: "/dashboard/services",
        label: "Subir Historia",
        icon: PlusCircle,
        protected: true,
        iconClassName: "text-[#ff4b4b]",
      });
    }

    return base;
  }, [isMotelProfile, unreadChats, isBusiness]);

  const mobileItems: BaseItem[] = [
    { href: "/", label: "Home", icon: Home, protected: false },
    { href: "/services?view=map&near=1&radiusKm=4", label: "Cerca", icon: MapPin, protected: false },
    { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
    { href: "/cuenta", label: "Cuenta", icon: User, protected: false },
  ];

  return (
    <>
      <aside className="hidden md:flex h-screen sticky top-0 w-[250px] shrink-0 flex-col border-r border-white/10 bg-black/40 backdrop-blur">
        {!isClientOrGuest ? (
          <div className="px-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/65">Cuenta · Tier actual</span>
                <Crown className="h-3.5 w-3.5 text-white/60" />
              </div>
              <div className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tierInfo.className}`}>{tierInfo.label}</div>
            </div>
          </div>
        ) : null}

        <nav className="px-3 py-3">
          <div className="grid gap-2">
            {desktopItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href.includes("?") && pathname === item.href.split("?")[0]);
              const Icon = item.icon;
              const href = item.protected && !isAuthed ? `/login?next=${encodeURIComponent(item.href)}` : item.href;
              return (
                <Link key={item.href} href={href} className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"}`}>
                  <Icon className={`h-4 w-4 ${item.iconClassName || ""}`} />
                  {item.label}
                  {item.badge ? <span className="ml-auto min-w-5 rounded-full bg-[#ff4b4b] px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">{item.badge > 99 ? "99+" : item.badge}</span> : null}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <MapPin className="h-3.5 w-3.5 text-[#ff4b4b]" />
              <span className="truncate">{detectedLocation || "Ubicación no detectada"}</span>
            </div>
            <Link href="/services?view=map&near=1&radiusKm=4" className="mt-1 block text-[11px] text-white/50 hover:text-white/80">
              Vinculado a Cerca tuyo · 4km
            </Link>
          </div>
        </nav>

        <div className="mt-auto p-4 text-xs text-white/40">Encuentra profesionales y establecimientos confiables.</div>
      </aside>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/60 backdrop-blur-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-[520px] grid-cols-4 px-2 py-2">
          {mobileItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href.includes("?") && pathname === item.href.split("?")[0]);
            const Icon = item.icon;
            const href = item.protected && !isAuthed ? `/login?next=${encodeURIComponent(item.href)}` : item.href;
            return (
              <Link key={item.href} href={href} className="relative flex flex-col items-center gap-1 py-2 text-[11px]">
                <Icon className={`h-5 w-5 ${active ? "text-white" : "text-white/50"}`} />
                <span className={active ? "text-white" : "text-white/50"}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
