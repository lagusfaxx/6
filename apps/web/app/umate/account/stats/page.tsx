"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, Loader2, TrendingUp, Users } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = {
  subscriberCount: number;
  newSubsThisCycle: number;
  totalPosts: number;
  totalLikes: number;
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
};

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/umate/creator/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => {
    if (!stats) return null;
    const engagement = stats.totalPosts > 0 ? stats.totalLikes / stats.totalPosts : 0;
    const conversion = stats.totalLikes > 0 ? (stats.subscriberCount / stats.totalLikes) * 100 : 0;
    const growth = stats.subscriberCount > 0 ? (stats.newSubsThisCycle / stats.subscriberCount) * 100 : 0;
    return { engagement, conversion, growth };
  }, [stats]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats || !analytics) return <div className="py-20 text-center text-slate-500">No eres creadora aún.</div>;

  const contentPerformance = [
    { label: "Promedio de likes por post", value: analytics.engagement.toFixed(1), pct: Math.min(100, analytics.engagement * 2) },
    { label: "Conversión likes → suscriptoras", value: `${analytics.conversion.toFixed(1)}%`, pct: Math.min(100, analytics.conversion * 2) },
    { label: "Crecimiento del ciclo", value: `${analytics.growth.toFixed(1)}%`, pct: Math.min(100, analytics.growth * 5) },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <header className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-white via-indigo-50 to-fuchsia-50 p-6 shadow-sm">
        <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-[11px] font-semibold text-indigo-700"><BarChart3 className="h-3.5 w-3.5" /> Analytics</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Estadísticas de rendimiento</h1>
        <p className="mt-1 text-sm text-slate-600">Interpretación de crecimiento, engagement y conversión para tomar decisiones.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><Users className="h-4 w-4 text-fuchsia-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.subscriberCount.toLocaleString()}</p><p className="text-xs text-slate-500">Base de suscriptoras</p></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><TrendingUp className="h-4 w-4 text-emerald-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.newSubsThisCycle.toLocaleString()}</p><p className="text-xs text-slate-500">Altas del ciclo</p></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><BarChart3 className="h-4 w-4 text-indigo-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.totalPosts.toLocaleString()}</p><p className="text-xs text-slate-500">Posts medidos</p></div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Rendimiento por contenido</h2>
          <div className="mt-4 space-y-4">
            {contentPerformance.map((metric) => (
              <div key={metric.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">{metric.label}</span>
                  <span className="font-bold text-slate-900">{metric.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${metric.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Insight rápido</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="rounded-xl bg-slate-50 p-3">Engagement promedio por pieza: <strong className="text-slate-900">{analytics.engagement.toFixed(1)} likes</strong>.</li>
            <li className="rounded-xl bg-slate-50 p-3">Cada 100 likes convierten ~<strong className="text-slate-900">{analytics.conversion.toFixed(1)} suscriptoras</strong>.</li>
            <li className="rounded-xl bg-slate-50 p-3">Tasa de crecimiento actual: <strong className="text-slate-900">{analytics.growth.toFixed(1)}%</strong> del total.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
