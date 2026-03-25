"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Eye,
  Heart,
  Loader2,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
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
    apiFetch<Stats>("/umate/creator/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => {
    if (!stats) return null;
    const engagement = stats.totalPosts > 0 ? stats.totalLikes / stats.totalPosts : 0;
    const conversion = stats.totalLikes > 0 ? (stats.subscriberCount / stats.totalLikes) * 100 : 0;
    const growth = stats.subscriberCount > 0 ? (stats.newSubsThisCycle / stats.subscriberCount) * 100 : 0;
    const revenuePerSub = stats.subscriberCount > 0 ? stats.totalEarned / stats.subscriberCount : 0;
    const churnRate = stats.subscriberCount > 0 ? (Math.round(stats.newSubsThisCycle * 0.28) / stats.subscriberCount) * 100 : 0;
    return { engagement, conversion, growth, revenuePerSub, churnRate };
  }, [stats]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats || !analytics) return <div className="py-24 text-center text-slate-500">No eres creadora aún.</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 shadow-lg shadow-indigo-200/30">
            <BarChart3 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Estadísticas</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Analytics de rendimiento, crecimiento y conversión.</p>
      </div>

      {/* Headline KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fuchsia-50">
              <Users className="h-4 w-4 text-fuchsia-600" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{stats.subscriberCount.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Base de suscriptoras</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">+{stats.newSubsThisCycle}</p>
          <p className="text-xs text-slate-500">Altas del ciclo</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50">
              <Eye className="h-4 w-4 text-sky-600" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{stats.totalPosts.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Publicaciones activas</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50">
              <Heart className="h-4 w-4 text-rose-500" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{stats.totalLikes.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Likes totales</p>
        </div>
      </section>

      {/* Performance metrics */}
      <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Rendimiento por contenido</h2>
          <div className="mt-5 space-y-5">
            {[
              { label: "Engagement promedio", value: `${analytics.engagement.toFixed(1)} likes/post`, pct: Math.min(100, analytics.engagement * 3), color: "from-fuchsia-500 to-rose-500" },
              { label: "Conversión likes → suscriptoras", value: `${analytics.conversion.toFixed(1)}%`, pct: Math.min(100, analytics.conversion * 2), color: "from-indigo-500 to-violet-500" },
              { label: "Crecimiento del ciclo", value: `${analytics.growth.toFixed(1)}%`, pct: Math.min(100, analytics.growth * 5), color: "from-emerald-500 to-teal-500" },
              { label: "Revenue por suscriptora", value: `$${Math.round(analytics.revenuePerSub).toLocaleString("es-CL")}`, pct: Math.min(100, analytics.revenuePerSub / 100), color: "from-amber-500 to-orange-500" },
              { label: "Tasa de churn estimada", value: `${analytics.churnRate.toFixed(1)}%`, pct: Math.min(100, analytics.churnRate * 3), color: "from-rose-500 to-red-500" },
            ].map((metric) => (
              <div key={metric.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-600">{metric.label}</span>
                  <span className="font-bold text-slate-900">{metric.value}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full bg-gradient-to-r ${metric.color} transition-all duration-700`} style={{ width: `${metric.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-indigo-700">
              <Zap className="h-4 w-4" /> Insights del ciclo
            </h2>
            <ul className="mt-3 space-y-3">
              <li className="rounded-xl bg-white/80 p-3 text-sm text-slate-700">
                Engagement promedio: <strong>{analytics.engagement.toFixed(1)}</strong> likes por publicación.
                {analytics.engagement > 5 ? " Excelente ritmo." : " Hay espacio para mejorar."}
              </li>
              <li className="rounded-xl bg-white/80 p-3 text-sm text-slate-700">
                Cada 100 likes generan ~<strong>{analytics.conversion.toFixed(1)}</strong> suscriptoras nuevas.
              </li>
              <li className="rounded-xl bg-white/80 p-3 text-sm text-slate-700">
                Crecimiento neto del ciclo: <strong>{analytics.growth.toFixed(1)}%</strong> de la base total.
              </li>
              <li className="rounded-xl bg-white/80 p-3 text-sm text-slate-700">
                Revenue promedio por suscriptora: <strong>${Math.round(analytics.revenuePerSub).toLocaleString("es-CL")}</strong>.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Métricas financieras</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-emerald-50 p-3">
                <span className="text-xs font-semibold text-emerald-700">Total ganado</span>
                <span className="font-bold text-emerald-800">${stats.totalEarned.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-xs font-semibold text-slate-600">Disponible</span>
                <span className="font-bold text-slate-900">${stats.availableBalance.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-50 p-3">
                <span className="text-xs font-semibold text-amber-700">Retenido</span>
                <span className="font-bold text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>

          {/* Top content hint */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Recomendación</h2>
            <p className="mt-2 text-sm text-slate-600">
              {analytics.growth > 10
                ? "Tu crecimiento es fuerte. Mantén la frecuencia de publicación y experimenta con contenido premium para maximizar conversión."
                : analytics.growth > 3
                  ? "Buen momentum. Considera publicar al menos 2–3 piezas premium por semana para acelerar el crecimiento."
                  : "El crecimiento es moderado. Aumenta la frecuencia de publicación y prueba posts de entrada gratuitos para atraer nuevos fans."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
