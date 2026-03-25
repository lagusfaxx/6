"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Users, Wallet, BarChart3, FileText, Sparkles, Loader2, ChevronRight, Compass, Home, UserCircle2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type SubStatus = {
  active: boolean;
  plan?: { name: string; priceCLP: number };
  slotsTotal?: number;
  slotsUsed?: number;
  slotsAvailable?: number;
};

type CreatorInfo = { id: string; status: string; subscriberCount?: number } | null;

export default function UmateAccountPage() {
  const { me } = useMe();
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<SubStatus>("/umate/subscription/status").catch(() => null),
      apiFetch<{ creator: CreatorInfo }>("/umate/creator/me").catch(() => null),
    ]).then(([s, c]) => {
      setSub(s);
      setCreator(c?.creator || null);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;

  const userNav = [
    { href: "/umate", label: "Inicio", icon: Home },
    { href: "/umate/explore", label: "Explorar", icon: Compass },
    { href: "/umate/creators", label: "Creadoras", icon: Users },
    { href: "/umate/plans", label: "Planes", icon: Crown },
  ];

  const creatorNav = [
    { href: "/umate/account/creator", label: "Resumen", icon: Sparkles },
    { href: "/umate/account/content", label: "Contenido", icon: FileText },
    { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users },
    { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
    { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3 },
    { href: "/umate/account", label: "Cuenta", icon: UserCircle2 },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-6">
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">{me?.user?.avatarUrl && <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" />}</div>
          <div>
            <h1 className="text-xl font-black text-slate-900">{me?.user?.displayName || me?.user?.username}</h1>
            <p className="text-sm text-slate-500">@{me?.user?.username}</p>
          </div>
        </div>

        {sub?.active && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-800">{sub.plan?.name}</p>
            <p className="text-xs text-amber-700">{sub.slotsAvailable} cupos disponibles de {sub.slotsTotal}</p>
            <div className="mt-2 h-2 rounded-full bg-amber-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500" style={{ width: `${((sub.slotsUsed || 0) / (sub.slotsTotal || 1)) * 100}%` }} /></div>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-wide text-slate-500">Parte usuario</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {userNav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 hover:bg-slate-50">
              <item.icon className="h-4 w-4 text-fuchsia-600" />
              <span className="font-semibold text-slate-700">{item.label}</span>
              <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
            </Link>
          ))}
        </div>
      </section>

      {creator && (
        <section className="rounded-3xl border border-fuchsia-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wide text-fuchsia-700">Modo creadora</h2>
          <p className="mt-1 text-xs text-slate-500">Contenido, negocio, métricas y cuenta en rutas separadas.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {creatorNav.map((item) => (
              <Link key={item.href + item.label} href={item.href} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 hover:bg-slate-50">
                <item.icon className="h-4 w-4 text-fuchsia-600" />
                <span className="font-semibold text-slate-700">{item.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
