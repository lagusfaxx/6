"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Compass,
  Crown,
  FileStack,
  Home,
  LayoutDashboard,
  Settings,
  Users2,
  Wallet,
} from "lucide-react";

const publicItems = [
  { href: "/umate", label: "Inicio", icon: Home, exact: true },
  { href: "/umate/explore", label: "Explorar", icon: Compass },
  { href: "/umate/creators", label: "Creadoras", icon: Users2 },
  { href: "/umate/plans", label: "Planes", icon: Crown },
];

const studioItems = [
  { href: "/umate/account/creator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/umate/account/content", label: "Posts", icon: FileStack },
  { href: "/umate/account/subscribers", label: "Fans", icon: Users2 },
  { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
  { href: "/umate/account/stats", label: "Stats", icon: BarChart3 },
  { href: "/umate/account", label: "Cuenta", icon: Settings, exact: true },
];

export default function UmateMobileNav() {
  const pathname = usePathname();
  const isStudio = pathname.startsWith("/umate/account");
  const items = isStudio ? studioItems : publicItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-fuchsia-100/60 bg-white/95 backdrop-blur-2xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition ${
                active ? "text-fuchsia-700" : "text-slate-400"
              }`}
            >
              <div className={`rounded-lg p-1 ${active ? "bg-fuchsia-50" : ""}`}>
                <item.icon className={`h-5 w-5 ${active ? "text-fuchsia-600" : ""}`} />
              </div>
              <span className={`text-[10px] font-semibold ${active ? "text-fuchsia-700" : ""}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
