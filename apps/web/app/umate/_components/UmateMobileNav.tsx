"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  Home,
  Plus,
  User,
  Wallet,
} from "lucide-react";

const items = [
  { href: "/umate", label: "Inicio", icon: Home, exact: true },
  { href: "/umate/explore", label: "Explorar", icon: Compass },
  { href: "/umate/account/content", label: "Publicar", icon: Plus, isAction: true },
  { href: "/umate/account/wallet", label: "Billetera", icon: Wallet },
  { href: "/umate/account", label: "Perfil", icon: User, exact: true },
];

export default function UmateMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around px-1 py-1.5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00aff0]">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 transition ${
                active ? "text-white" : "text-white/30"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
