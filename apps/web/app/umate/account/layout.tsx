"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FileStack, LayoutDashboard, Settings, Users2, Wallet } from "lucide-react";

const studioTabs = [
  { href: "/umate/account/creator", label: "Dashboard", icon: LayoutDashboard, desc: "Centro de control" },
  { href: "/umate/account/content", label: "Publicaciones", icon: FileStack, desc: "Biblioteca y editor" },
  { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users2, desc: "Relación y conversión" },
  { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet, desc: "Balance y retiros" },
  { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3, desc: "Analytics y métricas" },
  { href: "/umate/account", label: "Cuenta", icon: Settings, desc: "Perfil y ajustes" },
];

export default function UmateAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="h-fit rounded-3xl border border-fuchsia-100 bg-white p-3 shadow-sm lg:sticky lg:top-20">
        <p className="px-2 pb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Studio creadora</p>
        <div className="space-y-1.5">
          {studioTabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`block rounded-2xl border px-3 py-2.5 transition ${
                  active
                    ? "border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 to-rose-50"
                    : "border-transparent hover:border-slate-100 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <tab.icon className={`h-4 w-4 ${active ? "text-fuchsia-700" : "text-slate-500"}`} />
                  <p className={`text-sm font-semibold ${active ? "text-fuchsia-700" : "text-slate-700"}`}>{tab.label}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{tab.desc}</p>
              </Link>
            );
          })}
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}
