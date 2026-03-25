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
      <div className="sticky top-16 z-20 mb-4 overflow-x-auto rounded-2xl border border-slate-100 bg-white/90 p-2 backdrop-blur">
        <div className="flex gap-1">
          {creatorTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                pathname === tab.href ? "bg-fuchsia-100 text-fuchsia-700" : "text-slate-500 hover:bg-slate-100"
              }`}
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
