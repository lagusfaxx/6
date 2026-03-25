"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, User, Flame, Compass, Crown } from "lucide-react";
import useMe from "../../../hooks/useMe";

export default function UmateHeader() {
  const pathname = usePathname();
  const { me } = useMe();

  const navItems = [
    { href: "/umate", label: "Inicio", icon: Flame },
    { href: "/umate/explore", label: "Explorar", icon: Compass },
    { href: "/umate/plans", label: "Planes", icon: Crown },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-5">
          <Link href="/umate" className="flex items-center gap-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-rose-500 to-pink-500">
              <span className="text-sm font-extrabold text-white">U</span>
            </div>
            <span className="text-base font-extrabold tracking-tight hidden sm:block">
              <span className="text-white">U</span>
              <span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">-Mate</span>
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-0.5 md:flex">
            {navItems.map((item) => {
              const isActive =
                item.href === "/umate"
                  ? pathname === "/umate"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/35 hover:text-white/60 hover:bg-white/[0.03]"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/35 transition hover:border-white/[0.15] hover:text-white/60"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">UZEED</span>
          </Link>

          {me?.user && (
            <Link
              href="/umate/account"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition ${
                pathname.startsWith("/umate/account")
                  ? "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25"
                  : "bg-white/[0.04] text-white/35 hover:bg-white/[0.08] hover:text-white/60"
              }`}
            >
              {me.user.avatarUrl ? (
                <img src={me.user.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <User className="h-4 w-4" />
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile nav — bottom-style tabs */}
      <div className="flex items-center justify-center gap-1 border-t border-white/[0.04] px-4 py-1 md:hidden">
        {navItems.map((item) => {
          const isActive =
            item.href === "/umate"
              ? pathname === "/umate"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1 shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition ${
                isActive
                  ? "bg-rose-500/15 text-rose-300"
                  : "text-white/30 hover:text-white/50"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
