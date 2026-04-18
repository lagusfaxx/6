"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  Compass,
  Crown,
  FileStack,
  Heart,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Tag,
  UserCircle2,
  Users2,
  Wallet,
} from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";

const creatorGroups = [
  {
    title: "Perfil",
    items: [
      { href: "/umate/account", label: "Inicio", icon: Settings, exact: true },
      { href: "/umate/account/profile", label: "Perfil público", icon: UserCircle2 },
      { href: "/umate/account/pricing", label: "Tarifa mensual", icon: Tag },
    ],
  },
  {
    title: "Contenido",
    items: [
      { href: "/umate/account/creator", label: "Dashboard", icon: LayoutDashboard },
      { href: "/umate/account/content", label: "Publicaciones", icon: FileStack },
      { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users2 },
    ],
  },
  {
    title: "Ganancias",
    items: [
      { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
      { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3 },
    ],
  },
  {
    title: "Cuenta",
    items: [{ href: "/umate/account/legal", label: "Legal y cumplimiento", icon: ShieldCheck }],
  },
];

const clientGroups = [
  {
    title: "Cuenta",
    items: [
      { href: "/umate/account", label: "Mi cuenta", icon: Settings, exact: true },
      { href: "/umate/account/subscriptions", label: "Mis suscripciones", icon: Heart },
    ],
  },
  {
    title: "Descubre",
    items: [{ href: "/umate/explore", label: "Explorar creadoras", icon: Compass }],
  },
];

export default function UmateAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me } = useMe();
  const [isCreator, setIsCreator] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!me?.user) {
      setLoaded(true);
      return;
    }
    apiFetch<{ creator: any }>("/umate/creator/me")
      .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [me]);

  const groups = isCreator ? creatorGroups : clientGroups;

  const onIndex = pathname === "/umate/account";
  const currentTitle = (() => {
    for (const group of groups) {
      for (const item of group.items) {
        const match =
          "exact" in item && item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
        if (match) return item.label;
      }
    }
    return null;
  })();

  return (
    <div className="mx-auto w-full max-w-[1170px] px-4 py-5 sm:py-6">
      {/* Mobile back bar — visible on subpages only, hidden on lg+ where sidebar is present */}
      {!onIndex && (
        <div className="-mx-4 mb-4 border-b border-white/[0.05] bg-white/[0.015] px-4 py-2.5 lg:hidden">
          <Link
            href="/umate/account"
            className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4 text-[#00aff0]" />
            <span className="truncate">Volver a Mi cuenta{currentTitle ? ` · ${currentTitle}` : ""}</span>
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
            <div className="px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">
                {isCreator ? "Creator Studio" : "Mi cuenta"}
              </p>
            </div>

            {groups.map((group) => (
              <div key={group.title}>
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((tab) => {
                    const active =
                      "exact" in tab && tab.exact
                        ? pathname === tab.href
                        : pathname === tab.href || pathname.startsWith(tab.href + "/");
                    return (
                      <Link
                        key={tab.href}
                        href={tab.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-150 ${
                          active
                            ? "bg-[#00aff0]/[0.12] font-semibold text-white"
                            : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                        }`}
                      >
                        <tab.icon className={`h-4 w-4 ${active ? "text-[#00aff0]" : ""}`} />
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {!isCreator && loaded && (
              <>
                <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                <Link
                  href="/umate/onboarding"
                  className="mx-1 flex items-center gap-3 rounded-xl bg-gradient-to-r from-[#00aff0]/[0.08] to-purple-500/[0.04] px-3 py-2.5 text-sm font-semibold text-[#00aff0] transition hover:from-[#00aff0]/[0.14]"
                >
                  <Crown className="h-4 w-4" />
                  Ser creadora
                </Link>
              </>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
