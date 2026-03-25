"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown, Users, CreditCard, LayoutDashboard, FileText, Settings, LogOut, ChevronRight, Loader2, Shield, Flame } from "lucide-react";
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
  subscriberCount?: number;
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
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400/60" /></div>;
  }

  const isActiveCreator = creator && creator.status !== "SUSPENDED";

  const menuItems = [
    // Subscriber menu items (only if not a creator)
    ...(sub?.active ? [
      { href: "/umate/account", label: "Mi plan", desc: `${sub.plan?.name} — ${sub.slotsAvailable} cupos disponibles`, icon: Crown },
    ] : !isActiveCreator ? [
      { href: "/umate/plans", label: "Obtener plan", desc: "Suscríbete para acceder a contenido exclusivo", icon: Crown },
    ] : []),
    // Creator menu items
    ...(creator ? [
      { href: "/umate/account/creator", label: "Dashboard creadora", desc: `${creator.subscriberCount || 0} suscriptores`, icon: LayoutDashboard },
      { href: "/umate/account/content", label: "Mi contenido", desc: "Publicar y gestionar posts", icon: FileText },
      { href: "/umate/account/wallet", label: "Billetera", desc: "Ingresos, retiros y liquidaciones", icon: CreditCard },
      { href: "/umate/account/stats", label: "Estadísticas", desc: "Métricas y rendimiento", icon: Users },
    ] : []),
    { href: "/umate/rules", label: "Reglas", desc: "Normas de la plataforma", icon: Shield },
    { href: "/umate/terms", label: "Términos", desc: "Términos y condiciones", icon: FileText },
  ];

  return (
    <div className="mx-auto max-w-lg py-8 space-y-6">
      {/* User info — OnlyFans style header */}
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full bg-white/10 ring-2 ring-rose-500/20">
          {me?.user?.avatarUrl && <img src={me.user.avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold truncate">{me?.user?.displayName || me?.user?.username}</p>
          <p className="text-xs text-white/30">@{me?.user?.username}</p>
          {isActiveCreator && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[9px] font-bold text-rose-300">
              <Flame className="h-2.5 w-2.5" /> CREADORA
            </span>
          )}
          {sub?.active && !isActiveCreator && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300">
              <Crown className="h-2.5 w-2.5" /> {sub.plan?.name}
            </span>
          )}
        </div>
      </div>

      {/* Active plan card — only for subscribers */}
      {sub?.active && (
        <div className="rounded-2xl border border-rose-500/15 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-rose-400/70">Plan {sub.plan?.name}</p>
              <p className="mt-1 text-lg font-extrabold">${sub.plan?.priceCLP?.toLocaleString("es-CL")} <span className="text-sm font-normal text-white/30">/mes</span></p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-extrabold text-rose-300">{sub.slotsAvailable}</p>
              <p className="text-[10px] text-white/30">cupos disponibles</p>
            </div>
          </div>
          {/* Slot usage bar */}
          <div className="mt-4">
            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all"
                style={{ width: `${((sub.slotsUsed || 0) / (sub.slotsTotal || 1)) * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/25">
              <span>{sub.slotsUsed}/{sub.slotsTotal} cupos usados</span>
              {sub.cycleEnd && <span>Renueva {new Date(sub.cycleEnd).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}</span>}
            </div>
          </div>

          {/* Subscribed creators */}
          {sub.subscribedCreators && sub.subscribedCreators.length > 0 && (
            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-semibold text-white/30">Suscripciones activas</p>
              {sub.subscribedCreators.map((c) => (
                <Link
                  key={c.id}
                  href={`/umate/profile/${c.username}`}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.03] p-2.5 transition hover:bg-white/[0.06]"
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/[0.06]">
                    {c.avatarUrl && <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-xs font-bold">{c.displayName}</p>
                    <p className="text-[10px] text-white/25">@{c.username}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-white/15" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Creator CTA — only for non-creators and non-subscribers */}
      {!creator && !sub?.active && (
        <Link
          href="/umate/onboarding"
          className="block rounded-2xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-5 transition hover:border-amber-500/25"
        >
          <p className="text-sm font-bold">¿Quieres ser creadora?</p>
          <p className="mt-1 text-xs text-white/35">Publica contenido y monetiza tu perfil</p>
          <span className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
            Empezar <ChevronRight className="h-3 w-3" />
          </span>
        </Link>
      )}

      {/* Role restriction notice — for creators */}
      {isActiveCreator && !sub?.active && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-xs text-white/30 leading-relaxed">
            <Shield className="inline h-3.5 w-3.5 mr-1 -mt-0.5 text-white/20" />
            Como creadora, no puedes suscribirte a planes de cliente. Para ver contenido de otras creadoras, usa una cuenta diferente.
          </p>
        </div>
      )}

      {/* Menu */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden">
        {menuItems.map((item) => (
          <Link
            key={item.href + item.label}
            href={item.href}
            className="flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-white/[0.03]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
              <item.icon className="h-4 w-4 text-white/25" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="truncate text-[11px] text-white/30">{item.desc}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/15" />
          </Link>
        ))}
      </div>

      <Link
        href="/"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] py-3.5 text-xs text-white/30 transition hover:text-white/50"
      >
        <LogOut className="h-3.5 w-3.5" /> Volver a UZEED
      </Link>
    </div>
  );
}
