"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Users, CreditCard, LayoutDashboard, FileText, Settings, LogOut, ChevronRight, Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import useMe from "../../../hooks/useMe";

type SubStatus = {
  active: boolean;
  plan?: { tier: string; name: string; priceCLP: number };
  slotsTotal?: number;
  slotsUsed?: number;
  slotsAvailable?: number;
  cycleStart?: string;
  cycleEnd?: string;
  subscribedCreators?: { id: string; displayName: string; avatarUrl: string | null; username: string; expiresAt: string }[];
};

type CreatorInfo = {
  id: string;
  status: string;
  displayName: string;
} | null;

export default function UmateAccountPage() {
  const { me } = useMe();
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [creator, setCreator] = useState<CreatorInfo>(undefined as any);
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

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /></div>;
  }

  const menuItems = [
    ...(sub?.active ? [
      { href: "/umate/account", label: "Mi plan", desc: `${sub.plan?.name} — ${sub.slotsAvailable} cupos disponibles`, icon: Crown },
    ] : [
      { href: "/umate/plans", label: "Obtener plan", desc: "Suscríbete para acceder a contenido exclusivo", icon: Crown },
    ]),
    ...(creator ? [
      { href: "/umate/account/creator", label: "Dashboard creadora", desc: `${creator.subscriberCount || 0} suscriptores`, icon: LayoutDashboard },
      { href: "/umate/account/content", label: "Mi contenido", desc: "Publicar y gestionar posts", icon: FileText },
      { href: "/umate/account/wallet", label: "Billetera creadora", desc: "Ingresos, retiros y liquidaciones", icon: CreditCard },
      { href: "/umate/account/stats", label: "Estadísticas", desc: "Métricas y rendimiento", icon: Users },
    ] : []),
    { href: "/umate/rules", label: "Reglas", desc: "Normas de la plataforma", icon: FileText },
    { href: "/umate/terms", label: "Términos", desc: "Términos y condiciones", icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-lg py-8 space-y-6">
      {/* User info */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10">
          {me?.user?.avatarUrl && <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="font-semibold">{me?.user?.displayName || me?.user?.username}</p>
          <p className="text-xs text-white/40">@{me?.user?.username}</p>
        </div>
      </div>

      {/* Active plan card */}
      {sub?.active && (
        <div className="rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400/70">Plan {sub.plan?.name}</p>
              <p className="mt-1 text-lg font-bold">${sub.plan?.priceCLP?.toLocaleString("es-CL")} <span className="text-sm font-normal text-white/40">/mes</span></p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-rose-300">{sub.slotsAvailable}</p>
              <p className="text-[10px] text-white/40">cupos disponibles</p>
            </div>
          </div>
          {/* Slot usage bar */}
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all"
                style={{ width: `${((sub.slotsUsed || 0) / (sub.slotsTotal || 1)) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-white/30">{sub.slotsUsed}/{sub.slotsTotal} cupos usados este ciclo</p>
          </div>

          {/* Subscribed creators */}
          {sub.subscribedCreators && sub.subscribedCreators.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-medium text-white/40">Suscripciones activas</p>
              {sub.subscribedCreators.map((c) => (
                <Link
                  key={c.id}
                  href={`/umate/profile/${c.username}`}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]"
                >
                  <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                    {c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-medium">{c.displayName}</p>
                    <p className="text-[10px] text-white/30">@{c.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Creator CTA */}
      {!creator && (
        <Link
          href="/umate/onboarding"
          className="block rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-5 transition hover:border-amber-500/25"
        >
          <p className="text-sm font-semibold">¿Quieres ser creadora?</p>
          <p className="mt-1 text-xs text-white/40">Publica contenido y monetiza tu perfil</p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-400">
            Empezar <ChevronRight className="h-3 w-3" />
          </span>
        </Link>
      )}

      {/* Menu */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] divide-y divide-white/[0.05]">
        {menuItems.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.03]"
          >
            <item.icon className="h-4 w-4 shrink-0 text-white/30" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="truncate text-[11px] text-white/40">{item.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/20" />
          </Link>
        ))}
      </div>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-3 text-xs text-white/40 transition hover:text-white/60"
      >
        <LogOut className="h-3.5 w-3.5" /> Volver a UZEED
      </Link>
    </div>
  );
}
