"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const creatorTabs = [
  { href: "/umate/account/creator", label: "Resumen" },
  { href: "/umate/account/content", label: "Contenido" },
  { href: "/umate/account/subscribers", label: "Suscriptores" },
  { href: "/umate/account/wallet", label: "Ingresos" },
  { href: "/umate/account/stats", label: "Estadísticas" },
  { href: "/umate/account", label: "Cuenta" },
];

export default function UmateAccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div>
      <div className="sticky top-16 z-20 mb-5 overflow-x-auto rounded-2xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50/60 to-orange-50 p-2 shadow-sm backdrop-blur">
        <div className="flex gap-1.5">
          {creatorTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${pathname === tab.href ? "bg-white text-fuchsia-700 shadow-sm" : "text-slate-600 hover:bg-white/70"}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}
