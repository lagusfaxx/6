"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Compass,
  Crown,
  FileStack,
  Home,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  User,
  Users2,
  Wallet,
} from "lucide-react";
import useMe from "../../../hooks/useMe";

const publicNav = [
  { href: "/umate", label: "Inicio", icon: Home, exact: true },
  { href: "/umate/explore", label: "Explorar", icon: Compass },
  { href: "/umate/creators", label: "Creadoras", icon: Users2 },
  { href: "/umate/plans", label: "Planes", icon: Crown },
];

const studioNav = [
  { href: "/umate/account/creator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/umate/account/content", label: "Publicaciones", icon: FileStack },
  { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users2 },
  { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
  { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3 },
  { href: "/umate/account", label: "Cuenta", icon: Settings, exact: true },
];

export default function UmateHeader() {
  const pathname = usePathname();
  const { me } = useMe();
  const isStudio = pathname.startsWith("/umate/account");
  const navItems = isStudio ? studioNav : publicNav;

  return (
    <header className="sticky top-0 z-50 border-b border-fuchsia-100/60 bg-white/95 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-4 px-4 lg:px-6">
        {/* Logo */}
        <Link href="/umate" className="flex shrink-0 items-center rounded-2xl border border-fuchsia-100 bg-white/90 px-2.5 py-1.5 shadow-sm shadow-fuchsia-100/40 transition hover:border-fuchsia-200">
          <img src="/brand/Umate.webp" alt="U-Mate" className="h-8 w-auto object-contain sm:h-9" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {navItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-fuchsia-50 to-rose-50 text-fuchsia-700 shadow-sm shadow-fuchsia-100"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                }`}
              >
                <item.icon className={`h-4 w-4 ${active ? "text-fuchsia-600" : ""}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Search (public only) */}
          {!isStudio && (
            <button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-400 transition hover:border-slate-300 hover:text-slate-600 md:flex">
              <Search className="h-3.5 w-3.5" />
              <span>Buscar creadoras...</span>
            </button>
          )}

          {/* Context switch */}
          {!isStudio ? (
            <Link
              href="/umate/account/creator"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-fuchsia-500/20 transition hover:shadow-fuchsia-500/30 hover:brightness-105"
            >
              <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Studio</span>
            </Link>
          ) : (
            <Link
              href="/umate/explore"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-fuchsia-200 hover:text-fuchsia-700"
            >
              <Compass className="h-3.5 w-3.5" /> Ver público
            </Link>
          )}

          {/* Notifications */}
          <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-800">
            <Bell className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-rose-500" />
          </button>

          {/* Back to UZEED */}
          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-400 transition hover:border-slate-300 hover:text-slate-600 xl:flex"
          >
            <ArrowLeft className="h-3 w-3" /> UZEED
          </Link>

          {/* Avatar */}
          {me?.user && (
            <Link
              href="/umate/account"
              className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border-2 transition ${
                pathname.startsWith("/umate/account")
                  ? "border-fuchsia-400 shadow-lg shadow-fuchsia-200/50"
                  : "border-slate-200 hover:border-fuchsia-300"
              }`}
            >
              {me.user.avatarUrl ? (
                <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-slate-400" />
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
