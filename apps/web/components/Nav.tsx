"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, MessageCircle, Briefcase, User, Hotel } from "lucide-react";
import useMe from "../hooks/useMe";

const navItems = [
  { href: "/", label: "Home", icon: Home, protected: false },
  { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/servicios", label: "Servicios", icon: Briefcase, protected: true },
  { href: "/cuenta", label: "Cuenta", icon: User, protected: false }
];

export default function Nav() {
  const pathname = usePathname() || "/";
  const { me } = useMe();
  const isAuthed = Boolean(me?.user?.id);

  const role = String(me?.user?.role || "").toUpperCase();
  const ptype = String(me?.user?.profileType || "").toUpperCase();
  const isMotelProfile = ptype === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";

  const dynamicItems = isMotelProfile
    ? [
        { href: "/dashboard/motel", label: "Dashboard", icon: Hotel, protected: true },
        { href: "/chats", label: "Chat", icon: MessageCircle, protected: true }
      ]
    : navItems;

  return (
    <>
      <aside className="hidden md:flex h-screen sticky top-0 w-[240px] shrink-0 flex-col border-r border-white/10 bg-black/40 backdrop-blur">
        <div className="px-5 py-4" />
        <nav className="px-3">
          <div className="grid gap-2">
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
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="mt-auto p-4 text-xs text-white/40">
          Encuentra profesionales y establecimientos confiables.
        </div>
      </aside>

      <div
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-black/50 backdrop-blur-2xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-[520px] px-3 py-2" style={{ gridTemplateColumns: `repeat(${dynamicItems.length}, minmax(0, 1fr))` }}>
          {dynamicItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            const href = item.protected && !isAuthed
              ? `/login?next=${encodeURIComponent(item.href)}`
              : item.href;
            return (
              <Link key={item.href} href={href} className="flex flex-col items-center gap-1 py-2 text-[11px]">
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
