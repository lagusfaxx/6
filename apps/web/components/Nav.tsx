"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, MessageCircle, Briefcase, User, Hotel } from "lucide-react";
import useMe from "../hooks/useMe";

const navItems = [
  { href: "/", label: "Home", icon: Home, protected: false },
  { href: "/favoritos", label: "Favoritos", icon: Heart, protected: true },
  { href: "/chats", label: "Chat", icon: MessageCircle, protected: true },
  { href: "/servicios", label: "Servicios", icon: Briefcase, protected: false },
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
    <aside className="hidden md:flex h-screen sticky top-0 w-[240px] shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-black/50 via-purple-950/20 to-black/50 backdrop-blur-xl shadow-lg shadow-purple-500/5">
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
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-white shadow-lg shadow-purple-500/20 border border-purple-400/30"
                    : "text-white/70 hover:bg-white/10 hover:text-white border border-transparent"
                }`}
              >
                <Icon className={`h-5 w-5 ${active ? "text-purple-300" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="mt-auto p-4 text-xs text-white/50 leading-relaxed bg-gradient-to-r from-purple-500/5 to-fuchsia-500/5 border-t border-white/10">
        Encuentra profesionales y establecimientos confiables.
      </div>
    </aside>
  );
}
