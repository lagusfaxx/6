"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ChevronRight,
  FileStack,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users2,
  Wallet,
} from "lucide-react";

const studioTabs = [
  { href: "/umate/account/creator", label: "Dashboard", icon: LayoutDashboard, desc: "Centro de control" },
  { href: "/umate/account/content", label: "Publicaciones", icon: FileStack, desc: "Biblioteca y editor" },
  { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users2, desc: "Comunidad y fans" },
  { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet, desc: "Balance y retiros" },
  { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3, desc: "Analytics y métricas" },
  { href: "/umate/account", label: "Cuenta", icon: Settings, desc: "Perfil y ajustes", exact: true },
];

export default function UmateAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 lg:px-6">
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-1.5 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2 px-3 pb-3 pt-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-fuchsia-500 to-rose-500">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900">Creator Studio</p>
                <p className="text-[10px] text-slate-500">Panel de gestión</p>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {studioTabs.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition ${
                    active
                      ? "bg-gradient-to-r from-fuchsia-50 to-rose-50 shadow-sm"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <tab.icon className={`h-4 w-4 ${active ? "text-fuchsia-600" : "text-slate-400"}`} />
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${active ? "text-fuchsia-700" : "text-slate-700"}`}>{tab.label}</p>
                    <p className="text-[10px] text-slate-500">{tab.desc}</p>
                  </div>
                  {active && <ChevronRight className="h-3.5 w-3.5 text-fuchsia-400" />}
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
