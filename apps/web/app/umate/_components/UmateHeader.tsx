"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Compass,
  Home,
  MessageCircle,
  Plus,
  Search,
  User,
} from "lucide-react";
import useMe from "../../../hooks/useMe";

export default function UmateHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { me } = useMe();
  const isStudio = pathname.startsWith("/umate/account");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      router.push(`/umate/creators?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#08080d]/90 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-[56px] max-w-[1170px] items-center justify-between gap-3 px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <Link href="/umate" className="flex shrink-0 items-center gap-2">
            <img src="/brand/umate-logo-white.svg" alt="U-Mate" className="h-7 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: "/umate", icon: Home, label: "Inicio", exact: true },
              { href: "/umate/explore", icon: Compass, label: "Explorar" },
            ].map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium tracking-wide transition-all duration-200 ${
                    active
                      ? "text-white"
                      : "text-white/45 hover:text-white/70"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Center: Search */}
        <div className="hidden flex-1 justify-center md:flex">
          <form onSubmit={handleSearch} className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar creadoras..."
              className="w-full rounded-full border border-white/[0.06] bg-white/[0.03] py-2 pl-10 pr-4 text-sm text-white placeholder-white/25 outline-none transition-all duration-300 focus:border-[#00aff0]/40 focus:bg-white/[0.05] focus:shadow-[0_0_0_3px_rgba(0,175,240,0.06)]"
            />
          </form>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {me?.user && (
            <Link
              href="/umate/account/content"
              className="hidden items-center gap-1.5 rounded-full bg-[#00aff0] px-4 py-1.5 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(0,175,240,0.25)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_20px_rgba(0,175,240,0.35)] md:inline-flex"
            >
              <Plus className="h-4 w-4" /> Publicar
            </Link>
          )}

          <button className="flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.06] hover:text-white/70 md:hidden">
            <Search className="h-5 w-5" />
          </button>

          <Link
            href="/chats"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.06] hover:text-white/70"
          >
            <MessageCircle className="h-5 w-5" />
          </Link>

          <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/40 transition hover:bg-white/[0.06] hover:text-white/70">
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#00aff0]" />
          </button>

          {me?.user ? (
            <Link
              href="/umate/account"
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 transition ${
                isStudio
                  ? "border-[#00aff0]"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              {me.user.avatarUrl ? (
                <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <User className="h-4 w-4 text-white/50" />
              )}
            </Link>
          ) : (
            <Link
              href="/login?next=/umate"
              className="rounded-full bg-[#00aff0] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#00aff0]/90"
            >
              Iniciar sesión
            </Link>
          )}

          <Link
            href="/"
            className="hidden items-center gap-1 rounded-full border border-white/[0.08] px-3 py-1.5 text-[11px] font-medium text-white/40 transition hover:border-white/20 hover:text-white/50 xl:flex"
          >
            <ArrowLeft className="h-3 w-3" /> UZEED
          </Link>
        </div>
      </div>
    </header>
  );
}
