"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Compass,
  Crown,
  Home,
  LayoutDashboard,
  Settings,
  Sparkles,
  User,
  Users2,
  Wallet,
  FileStack,
} from "lucide-react";
import useMe from "../../../hooks/useMe";

const publicNav = [
  { href: "/umate", label: "Home", icon: Home },
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
  { href: "/umate/account", label: "Cuenta", icon: Settings },
];

export default function UmateHeader() {
  const pathname = usePathname();
  const { me } = useMe();
  const isStudio = pathname.startsWith("/umate/account");

  return (
    <header className="sticky top-0 z-50 border-b border-fuchsia-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-4">
        <div className="flex items-center gap-5">
          <Link href="/umate" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-400 shadow-sm">
              <span className="text-sm font-extrabold text-white">U</span>
            </div>
            <span className="hidden text-base font-black tracking-tight sm:block">
              <span className="text-slate-900">U</span>
              <span className="bg-gradient-to-r from-fuchsia-600 via-rose-500 to-orange-500 bg-clip-text text-transparent">-Mate</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {(isStudio ? studioNav : publicNav).map((item) => {
              const active = item.href === "/umate" ? pathname === "/umate" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    active ? "bg-fuchsia-50 text-fuchsia-700" : "text-slate-500 hover:bg-rose-50 hover:text-slate-900"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {!isStudio ? (
            <Link
              href="/umate/account/creator"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:brightness-105"
            >
              <Sparkles className="h-3.5 w-3.5" /> Ir al Studio
            </Link>
          ) : (
            <Link
              href="/umate/explore"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-600"
            >
              <Compass className="h-3.5 w-3.5" /> Ver público
            </Link>
          )}

          <Link
            href="/"
            className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-800 sm:flex"
          >
            <ArrowLeft className="h-3 w-3" /> UZEED
          </Link>

          {me?.user && (
            <Link
              href="/umate/account"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border transition ${
                pathname.startsWith("/umate/account")
                  ? "border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              {me.user.avatarUrl ? <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" /> : <User className="h-4 w-4" />}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
