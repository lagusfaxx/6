"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crown,
  Heart,
  Home,
  Plus,
  User,
  Users,
  Wallet,
} from "lucide-react";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
  isAction?: boolean;
};

const clientItems: NavItem[] = [
  { href: "/umate/explore", label: "Inicio", icon: Home, exact: true },
  { href: "/umate/creators", label: "Creadoras", icon: Users, exact: true },
  { href: "/umate/plans", label: "Planes", icon: Crown },
  { href: "/umate/account", label: "Cuenta", icon: User, exact: true },
];

const creatorItems: NavItem[] = [
  { href: "/umate/explore", label: "Inicio", icon: Home, exact: true },
  { href: "/umate/creators", label: "Creadoras", icon: Users, exact: true },
  { href: "/umate/account/content", label: "Publicar", icon: Plus, isAction: true },
  { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
  { href: "/umate/account", label: "Studio", icon: User, exact: true },
];

export default function UmateMobileNav() {
  const pathname = usePathname();
  const { me } = useMe();
  const [isCreator, setIsCreator] = useState(false);

  useEffect(() => {
    if (!me?.user) return;
    apiFetch<{ creator: any }>("/umate/creator/me")
      .then((d) => setIsCreator(Boolean(d?.creator && d.creator.status !== "SUSPENDED")))
      .catch(() => {});
  }, [me]);

  const items = isCreator ? creatorItems : clientItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.04] bg-[#0a0a12]/90 backdrop-blur-2xl backdrop-saturate-[1.8] lg:hidden">
      {/* Top glow accent */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00aff0]/15 to-transparent" />

      <div className="mx-auto flex max-w-md items-center justify-around px-1 pb-[env(safe-area-inset-bottom,6px)] pt-1.5">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

          if (item.isAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-0.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00aff0] to-[#0090d0] shadow-[0_2px_16px_rgba(0,175,240,0.4)]">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all duration-200 ${
                active ? "text-white" : "text-white/35"
              }`}
            >
              <div className={`relative rounded-xl p-1.5 transition-all duration-200 ${
                active ? "bg-[#00aff0]/10" : ""
              }`}>
                <item.icon className={`h-5 w-5 transition-colors ${
                  active ? "text-[#00aff0]" : "text-white/35"
                }`} />
              </div>
              <span className={`text-[10px] font-medium ${
                active ? "text-[#00aff0]" : ""
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
