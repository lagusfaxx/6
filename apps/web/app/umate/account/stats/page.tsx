"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  Heart,
  Loader2,
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/45" /></div>;
  if (!stats || !analytics) return <div className="py-24 text-center text-white/40">No eres creadora aún.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Estadisticas</h1>
        <p className="mt-1 text-sm text-white/40">Rendimiento, crecimiento y conversión.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Suscriptores", value: stats.subscriberCount.toLocaleString(), icon: Users, color: "text-[#00aff0]" },
          { label: "Altas del ciclo", value: `+${stats.newSubsThisCycle}`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Publicaciones", value: stats.totalPosts.toLocaleString(), icon: Eye, color: "text-purple-400" },
          { label: "Likes totales", value: stats.totalLikes.toLocaleString(), icon: Heart, color: "text-rose-400" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <m.icon className={`h-4 w-4 ${m.color}`} />
            <p className="mt-3 text-2xl font-extrabold text-white">{m.value}</p>
            <p className="text-xs text-white/40">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Performance bars */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Rendimiento</h2>
          <div className="mt-5 space-y-5">
            {[
              { label: "Engagement promedio", value: `${analytics.engagement.toFixed(1)} likes/post`, pct: Math.min(100, analytics.engagement * 3) },
              { label: "Conversión likes → subs", value: `${analytics.conversion.toFixed(1)}%`, pct: Math.min(100, analytics.conversion * 2) },
              { label: "Crecimiento del ciclo", value: `${analytics.growth.toFixed(1)}%`, pct: Math.min(100, analytics.growth * 5) },
              { label: "Revenue por suscriptor", value: `$${Math.round(analytics.revenuePerSub).toLocaleString("es-CL")}`, pct: Math.min(100, analytics.revenuePerSub / 100) },
              { label: "Tasa de churn estimada", value: `${analytics.churnRate.toFixed(1)}%`, pct: Math.min(100, analytics.churnRate * 3) },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">{m.label}</span>
                  <span className="font-semibold text-white/70">{m.value}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-[#00aff0] transition-all duration-700" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Insights */}
          <div className="rounded-2xl border border-[#00aff0]/15 bg-[#00aff0]/[0.04] p-5">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#00aff0]">
              <Zap className="h-4 w-4" /> Insights
            </h2>
            <ul className="mt-3 space-y-2">
              {[
                `Engagement: ${analytics.engagement.toFixed(1)} likes/post. ${analytics.engagement > 5 ? "Excelente." : "Hay espacio para mejorar."}`,
                `Cada 100 likes → ~${analytics.conversion.toFixed(1)} suscriptores.`,
                `Crecimiento: ${analytics.growth.toFixed(1)}% del total.`,
                `Revenue/sub: $${Math.round(analytics.revenuePerSub).toLocaleString("es-CL")}.`,
              ].map((t) => (
                <li key={t} className="rounded-lg bg-white/[0.04] p-3 text-sm text-white/40">{t}</li>
              ))}
            </ul>
          </div>

          {/* Financial */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Métricas financieras</h2>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-emerald-500/[0.06] p-2.5 text-sm">
                <span className="text-emerald-400/70">Total ganado</span>
                <span className="font-semibold text-emerald-400">${stats.totalEarned.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white/[0.03] p-2.5 text-sm">
                <span className="text-white/40">Disponible</span>
                <span className="font-semibold text-white">${stats.availableBalance.toLocaleString("es-CL")}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-amber-500/[0.06] p-2.5 text-sm">
                <span className="text-amber-400/70">Retenido</span>
                <span className="font-semibold text-amber-400">${stats.pendingBalance.toLocaleString("es-CL")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
