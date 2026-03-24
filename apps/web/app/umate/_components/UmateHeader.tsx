"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, User, Wallet, LayoutDashboard } from "lucide-react";
import useMe from "../../../hooks/useMe";

export default function UmateHeader() {
  const pathname = usePathname();
  const { me } = useMe();

  const navItems = [
    { href: "/umate", label: "Inicio" },
    { href: "/umate/explore", label: "Explorar" },
    { href: "/umate/plans", label: "Planes" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#08080f]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <Link href="/umate" className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">
              U<span className="bg-gradient-to-r from-rose-400 to-amber-400 bg-clip-text text-transparent">-Mate</span>
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive =
                item.href === "/umate"
                  ? pathname === "/umate"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-white/[0.08] text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
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
            className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-white/50 transition hover:border-white/[0.15] hover:text-white/80"
          >
            <ArrowLeft className="h-3 w-3" />
            <span className="hidden sm:inline">UZEED</span>
          </Link>

          {me?.user && (
            <>
              <Link
                href="/umate/account"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
              >
                <User className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile nav */}
      <div className="flex items-center gap-1 overflow-x-auto border-t border-white/[0.04] px-4 py-1.5 md:hidden">
        {navItems.map((item) => {
          const isActive =
            item.href === "/umate"
              ? pathname === "/umate"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition ${
                isActive
                  ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                  : "text-white/40"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
