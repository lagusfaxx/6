"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Heart, Loader2, TrendingDown, TrendingUp, UserPlus, Users } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = { subscriberCount: number; newSubsThisCycle: number; totalLikes: number; totalPosts: number };

export default function SubscribersPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/umate/creator/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const churn = useMemo(() => Math.max(Math.round((stats?.newSubsThisCycle || 0) * 0.28), 0), [stats?.newSubsThisCycle]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-20 text-center text-slate-500">No hay datos disponibles.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="rounded-3xl border border-fuchsia-100 bg-gradient-to-r from-white via-rose-50 to-fuchsia-50 p-6 shadow-sm">
        <h1 className="text-3xl font-black text-slate-900">Suscriptores y conversión</h1>
        <p className="mt-1 text-sm text-slate-600">Relación con la comunidad: crecimiento, riesgo de bajas y fans más activos.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><Users className="h-4 w-4 text-fuchsia-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.subscriberCount.toLocaleString()}</p><p className="text-xs text-slate-500">Activos</p></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><UserPlus className="h-4 w-4 text-emerald-700" /><p className="mt-2 text-2xl font-black text-emerald-800">+{stats.newSubsThisCycle.toLocaleString()}</p><p className="text-xs text-emerald-700">Altas recientes</p></div>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><TrendingDown className="h-4 w-4 text-rose-700" /><p className="mt-2 text-2xl font-black text-rose-800">-{churn.toLocaleString()}</p><p className="text-xs text-rose-700">Cancelaciones estimadas</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><Heart className="h-4 w-4 text-amber-700" /><p className="mt-2 text-2xl font-black text-amber-800">{stats.totalLikes.toLocaleString()}</p><p className="text-xs text-amber-700">Señales de afinidad</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Embudo del ciclo</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-700">1. Alcance estimado</p><p className="text-slate-500">{(stats.totalLikes * 4).toLocaleString()} usuarios impactados.</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-700">2. Interés real</p><p className="text-slate-500">{stats.totalLikes.toLocaleString()} reacciones o likes.</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="font-semibold text-slate-700">3. Conversión</p><p className="text-slate-500">+{stats.newSubsThisCycle.toLocaleString()} nuevas suscriptoras.</p></div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Top fans / recientes</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Crown className="h-3 w-3" /> Comunidad VIP</span>
          </div>
          <div className="mt-4 space-y-2">
            {["@luna_mode", "@alma.fit", "@mia.dark", "@valentinax"].map((fan, i) => (
              <div key={fan} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="font-semibold text-slate-700">{fan}</p>
                  <p className="text-xs text-slate-500">Actividad: {i % 2 === 0 ? "Nueva suscripción" : "Renovación mensual"}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" /> Activa</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
