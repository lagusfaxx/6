"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Heart, FileText, TrendingUp, AlertCircle, Loader2, Plus, Wallet, ArrowUpRight, Sparkles } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = {
  subscriberCount: number;
  newSubsThisCycle: number;
  totalPosts: number;
  totalLikes: number;
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
  status: string;
  bankConfigured: boolean;
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
};

export default function CreatorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/umate/creator/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-20 text-center text-slate-500">No eres creadora aún.</div>;

  const pendingItems = [!stats.bankConfigured && "Configurar datos bancarios", !stats.termsAccepted && "Aceptar términos", !stats.rulesAccepted && "Aceptar reglas", !stats.contractAccepted && "Aceptar contrato"].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl space-y-5 py-5">
      <section className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50/70 to-orange-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-[11px] font-semibold text-fuchsia-700"><Sparkles className="h-3.5 w-3.5" /> Modo creadora</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">Resumen de negocio</h1>
            <p className="text-sm text-slate-600">Métricas clave, ingresos y acciones prioritarias para crecer.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/umate/account/content" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25"><Plus className="h-4 w-4" />Nueva publicación</Link>
            <Link href="/umate/account/wallet" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"><Wallet className="h-4 w-4" />Ingresos</Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Suscriptores", value: stats.subscriberCount, icon: Users },
            { label: "Nuevos este ciclo", value: stats.newSubsThisCycle, icon: TrendingUp },
            { label: "Publicaciones", value: stats.totalPosts, icon: FileText },
            { label: "Likes", value: stats.totalLikes, icon: Heart },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><c.icon className="h-4 w-4 text-fuchsia-600" /><p className="mt-2 text-2xl font-black text-slate-900">{c.value.toLocaleString()}</p><p className="text-xs text-slate-500">{c.label}</p></div>
          ))}
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
          <div className="mt-3 space-y-2 text-sm">
            <Link href="/umate/account/content" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 font-semibold text-slate-700 hover:bg-slate-50">Subir contenido <ArrowUpRight className="h-4 w-4 text-slate-400" /></Link>
            <Link href="/umate/account/subscribers" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 font-semibold text-slate-700 hover:bg-slate-50">Ver suscriptores <ArrowUpRight className="h-4 w-4 text-slate-400" /></Link>
            <Link href="/umate/account/stats" className="flex items-center justify-between rounded-xl border border-slate-100 p-3 font-semibold text-slate-700 hover:bg-slate-50">Revisar estadísticas <ArrowUpRight className="h-4 w-4 text-slate-400" /></Link>
          </div>
        </div>
      </section>

      {pendingItems.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-amber-800"><AlertCircle className="h-4 w-4" />Completa tu configuración</p>
          <ul className="space-y-1 text-sm text-amber-700">{pendingItems.map((item) => <li key={item as string}>• {item}</li>)}</ul>
        </section>
      )}

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-semibold text-emerald-700">Disponible</p><p className="text-2xl font-black text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-xs font-semibold text-amber-700">Retenido</p><p className="text-2xl font-black text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</p></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5"><p className="text-xs font-semibold text-slate-600">Total ganado</p><p className="text-2xl font-black text-slate-900">${stats.totalEarned.toLocaleString("es-CL")}</p><Link href="/umate/account/wallet" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-700"><Wallet className="h-3.5 w-3.5" />Ir a ingresos</Link></div>
      </section>
    </div>
  );
}
