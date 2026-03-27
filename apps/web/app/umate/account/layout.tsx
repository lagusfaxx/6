"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileStack,
  LayoutDashboard,
  Settings,
  Users2,
  Wallet,
} from "lucide-react";

const studioTabs = [
  { href: "/umate/account/creator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/umate/account/content", label: "Publicaciones", icon: FileStack },
  { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users2 },
  { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
  { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3 },
  { href: "/umate/account", label: "Cuenta", icon: Settings, exact: true },
];

export default function UmateAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-[1170px] px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-0.5 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2">
            <div className="px-3 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Creator Studio</p>
            </div>
            <div className="h-px bg-white/[0.04]" />

            {studioTabs.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                    active
                      ? "bg-white/[0.05] text-white font-semibold"
                      : "text-white/40 hover:bg-white/[0.03] hover:text-white/55"
                  }`}
                >
                  <tab.icon className={`h-4 w-4 ${active ? "text-[#00aff0]" : ""}`} />
                  {tab.label}
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
