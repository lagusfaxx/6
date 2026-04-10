"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HelpCircle,
  Wallet,
  Coins,
  Radio,
  Video,
  Crown,
  MessageCircle,
  MessageSquare,
  Sparkles,
  User,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

const HELP_TOPICS = [
  { href: "/ayuda", label: "Inicio de ayuda", icon: HelpCircle, exact: true },
  { href: "/ayuda/billetera", label: "Billetera", icon: Wallet },
  { href: "/ayuda/tokens", label: "Tokens", icon: Coins },
  { href: "/ayuda/live", label: "Transmisiones en vivo", icon: Radio },
  { href: "/ayuda/videollamadas", label: "Videollamadas", icon: Video },
  { href: "/ayuda/tiers", label: "Tiers y planes", icon: Crown },
  { href: "/ayuda/chat", label: "Chat y mensajes", icon: MessageCircle },
  { href: "/ayuda/foro", label: "Foro", icon: MessageSquare },
  { href: "/ayuda/servicios", label: "Servicios y directorio", icon: Sparkles },
  { href: "/ayuda/cuenta", label: "Cuenta y perfil", icon: User },
  { href: "/ayuda/seguridad", label: "Seguridad y privacidad", icon: ShieldCheck },
];

export default function AyudaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/ayuda";

  return (
    <div className="mx-auto w-full max-w-6xl px-2 py-6 sm:px-4 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500/25 to-violet-500/20 border border-fuchsia-500/30 shadow-[0_0_24px_rgba(217,70,239,0.18)]">
          <HelpCircle className="h-5 w-5 text-fuchsia-300" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white leading-tight">Centro de Ayuda</h1>
          <p className="text-xs text-white/40">
            Guías completas sobre todas las funciones de UZEED
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar de temas (visible en desktop) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="mb-1 px-3 pt-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Temas
            </p>
            {HELP_TOPICS.map((topic) => {
              const Icon = topic.icon;
              const active = topic.exact
                ? pathname === topic.href
                : pathname === topic.href || pathname.startsWith(`${topic.href}/`);
              return (
                <Link
                  key={topic.href}
                  href={topic.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-gradient-to-r from-fuchsia-500/15 to-violet-500/10 border border-fuchsia-500/25 text-fuchsia-200 shadow-[0_0_18px_rgba(217,70,239,0.08)]"
                      : "text-white/70 border border-transparent hover:bg-white/[0.04] hover:text-white/90"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? "text-fuchsia-400" : "text-white/45 group-hover:text-fuchsia-400/70"
                    }`}
                  />
                  <span className="flex-1 truncate">{topic.label}</span>
                  {active && <ChevronRight className="h-3.5 w-3.5 text-fuchsia-400/70" />}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Contenido */}
        <div className="min-w-0">
          {/* Scroll horizontal de temas (mobile) */}
          <div className="mb-5 -mx-2 overflow-x-auto px-2 pb-2 lg:hidden">
            <div className="flex gap-2">
              {HELP_TOPICS.map((topic) => {
                const Icon = topic.icon;
                const active = topic.exact
                  ? pathname === topic.href
                  : pathname === topic.href || pathname.startsWith(`${topic.href}/`);
                return (
                  <Link
                    key={topic.href}
                    href={topic.href}
                    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      active
                        ? "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-200"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {topic.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
