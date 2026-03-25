"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, ChevronRight, Compass, Crown, Home, Loader2, Settings, ShieldCheck, UserCircle2, Users, Wallet } from "lucide-react";
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

type CreatorStats = {
  availableBalance: number;
  pendingBalance: number;
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  bankConfigured: boolean;
};

export default function UmateAccountPage() {
  const { me } = useMe();
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [creator, setCreator] = useState<CreatorInfo>(null);
  const [creatorStats, setCreatorStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<SubStatus>("/umate/subscription/status").catch(() => null),
      apiFetch<{ creator: CreatorInfo }>("/umate/creator/me").catch(() => null),
      apiFetch<CreatorStats>("/umate/creator/stats").catch(() => null),
    ]).then(([s, c, st]) => {
      setSub(s);
      setCreator(c?.creator || null);
      setCreatorStats(st);
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
    { href: "/umate/account/creator", label: "Resumen", icon: Settings },
    { href: "/umate/account/content", label: "Contenido", icon: UserCircle2 },
    { href: "/umate/account/subscribers", label: "Suscriptores", icon: Users },
    { href: "/umate/account/wallet", label: "Ingresos", icon: Wallet },
    { href: "/umate/account/stats", label: "Estadísticas", icon: BarChart3 },
  ];

  const checks = [
    { label: "Términos aceptados", ok: creatorStats?.termsAccepted },
    { label: "Reglas aceptadas", ok: creatorStats?.rulesAccepted },
    { label: "Contrato firmado", ok: creatorStats?.contractAccepted },
    { label: "Cuenta bancaria", ok: creatorStats?.bankConfigured },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-2xl bg-slate-100">{me?.user?.avatarUrl && <img src={me.user.avatarUrl} alt="avatar" className="h-full w-full object-cover" />}</div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Cuenta y configuración</h1>
            <p className="text-sm text-slate-500">Perfil, términos, estado financiero y accesos de tu modo creadora.</p>
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Perfil y estado</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Usuario</span><strong className="text-slate-900">@{me?.user?.username}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Nombre público</span><strong className="text-slate-900">{me?.user?.displayName || "Sin definir"}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Estado creadora</span><strong className="text-slate-900">{creator?.status || "No activa"}</strong></div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span className="text-slate-500">Bio</span><strong className="text-slate-900">Completa en perfil público</strong></div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Finanzas y plan</h2>
          <div className="mt-3 space-y-2 text-sm">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-xs text-emerald-700">Disponible</p><p className="font-black text-emerald-800">${(creatorStats?.availableBalance || 0).toLocaleString("es-CL")}</p></div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"><p className="text-xs text-amber-700">Retenido</p><p className="font-black text-amber-800">${(creatorStats?.pendingBalance || 0).toLocaleString("es-CL")}</p></div>
            {sub?.active && <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">Plan activo</p><p className="font-semibold text-slate-900">{sub.plan?.name}</p><p className="text-xs text-slate-500">{sub.slotsAvailable} cupos libres de {sub.slotsTotal}</p></div>}
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500"><ShieldCheck className="h-4 w-4" /> Estado legal y operativo</h2>
          <div className="mt-3 space-y-2">
            {checks.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">{item.label}</span>
                <span className={item.ok ? "inline-flex items-center gap-1 font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                  {item.ok ? <><CheckCircle2 className="h-3.5 w-3.5" /> Listo</> : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Navegación</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {userNav.concat(creator ? creatorNav : []).map((item) => (
              <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-sm transition hover:bg-slate-50">
                <item.icon className="h-4 w-4 text-fuchsia-600" />
                <span className="font-semibold text-slate-700">{item.label}</span>
                <ChevronRight className="ml-auto h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
