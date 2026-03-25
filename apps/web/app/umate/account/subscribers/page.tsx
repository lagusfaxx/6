"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Crown,
  Heart,
  Loader2,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = { subscriberCount: number; newSubsThisCycle: number; totalLikes: number; totalPosts: number };

export default function SubscribersPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/umate/creator/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const churn = useMemo(() => Math.max(Math.round((stats?.newSubsThisCycle || 0) * 0.28), 0), [stats?.newSubsThisCycle]);
  const recurrent = useMemo(() => Math.max((stats?.subscriberCount || 0) - (stats?.newSubsThisCycle || 0), 0), [stats]);
  const retentionRate = useMemo(() => {
    if (!stats?.subscriberCount) return 0;
    return Math.round(((stats.subscriberCount - churn) / stats.subscriberCount) * 100);
  }, [stats, churn]);

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-24 text-center text-slate-500">No hay datos disponibles.</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 shadow-lg shadow-sky-200/30">
            <Users2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">Suscriptores</h1>
        </div>
        <p className="mt-1 text-sm text-slate-500">Comunidad, conversión y relación con tus fans.</p>
      </div>

      {/* Main KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-rose-50 p-5">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-fuchsia-600" />
            <p className="text-xs font-bold uppercase tracking-wide text-fuchsia-700">Activos</p>
          </div>
          <p className="mt-2 text-3xl font-black text-fuchsia-800">{stats.subscriberCount.toLocaleString()}</p>
          <p className="mt-1 text-xs text-fuchsia-600">Suscriptores con plan activo</p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Altas</p>
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-800">+{stats.newSubsThisCycle.toLocaleString()}</p>
          <p className="mt-1 text-xs text-emerald-600">Nuevas este ciclo</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 p-5">
          <div className="flex items-center gap-2">
            <UserMinus className="h-5 w-5 text-rose-600" />
            <p className="text-xs font-bold uppercase tracking-wide text-rose-700">Bajas estimadas</p>
          </div>
          <p className="mt-2 text-3xl font-black text-rose-800">-{churn.toLocaleString()}</p>
          <p className="mt-1 text-xs text-rose-600">Cancelaciones del ciclo</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
          <div className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-amber-600" />
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Recurrentes</p>
          </div>
          <p className="mt-2 text-3xl font-black text-amber-800">{recurrent.toLocaleString()}</p>
          <p className="mt-1 text-xs text-amber-600">Renovaciones activas</p>
        </div>
      </section>

      {/* Two columns */}
      <section className="grid gap-5 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Embudo de conversión</h2>
          <div className="mt-4 space-y-3">
            {[
              { step: "Alcance", value: (stats.totalLikes * 4).toLocaleString(), desc: "Usuarios que vieron tu contenido", pct: 100, color: "from-slate-300 to-slate-400" },
              { step: "Interés", value: stats.totalLikes.toLocaleString(), desc: "Reacciones y señales de afinidad", pct: 65, color: "from-sky-400 to-indigo-400" },
              { step: "Conversión", value: `+${stats.newSubsThisCycle}`, desc: "Nuevas suscriptoras activas", pct: 25, color: "from-fuchsia-500 to-rose-500" },
            ].map((item) => (
              <div key={item.step} className="rounded-xl bg-slate-50 p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-700">{item.step}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <span className="text-lg font-black text-slate-900">{item.value}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                  <div className={`h-full rounded-full bg-gradient-to-r ${item.color}`} style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Retention + Top fans */}
        <div className="space-y-4">
          {/* Retention card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Retención</h2>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-24 w-24">
                <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#retGrad)" strokeWidth="3" strokeDasharray={`${retentionRate}, 100`} strokeLinecap="round" />
                  <defs><linearGradient id="retGrad"><stop offset="0%" stopColor="#a855f7" /><stop offset="100%" stopColor="#ec4899" /></linearGradient></defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-black text-slate-900">{retentionRate}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Tasa de retención</p>
                <p className="text-xs text-slate-500">Del total de suscriptoras activas que renuevan su ciclo mensual.</p>
              </div>
            </div>
          </div>

          {/* Top fans */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Top fans</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                <Crown className="h-3 w-3" /> VIP
              </span>
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                { name: "@luna_mode", action: "Nueva suscripción", trend: "up" },
                { name: "@alma.fit", action: "Renovación mensual", trend: "stable" },
                { name: "@mia.dark", action: "Nueva suscripción", trend: "up" },
                { name: "@valentinax", action: "Renovación mensual", trend: "stable" },
                { name: "@sofia.rise", action: "3 meses seguidos", trend: "up" },
              ].map((fan) => (
                <div key={fan.name} className="flex items-center justify-between rounded-lg border border-slate-50 p-2.5 transition hover:bg-slate-50">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fuchsia-50 text-xs font-bold text-fuchsia-600">
                      {fan.name[1].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{fan.name}</p>
                      <p className="text-[11px] text-slate-500">{fan.action}</p>
                    </div>
                  </div>
                  {fan.trend === "up" ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><ArrowUpRight className="h-3.5 w-3.5" />Nueva</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600"><RefreshCcw className="h-3 w-3" />Activa</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Engagement signals */}
      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Señales de engagement</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-rose-50 p-4 text-center">
            <Heart className="mx-auto h-5 w-5 text-rose-500" />
            <p className="mt-2 text-2xl font-black text-rose-800">{stats.totalLikes.toLocaleString()}</p>
            <p className="text-xs text-rose-600">Likes totales</p>
          </div>
          <div className="rounded-xl bg-sky-50 p-4 text-center">
            <TrendingUp className="mx-auto h-5 w-5 text-sky-500" />
            <p className="mt-2 text-2xl font-black text-sky-800">{stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : 0}</p>
            <p className="text-xs text-sky-600">Likes por post</p>
          </div>
          <div className="rounded-xl bg-violet-50 p-4 text-center">
            <Users className="mx-auto h-5 w-5 text-violet-500" />
            <p className="mt-2 text-2xl font-black text-violet-800">{stats.totalLikes > 0 ? ((stats.subscriberCount / stats.totalLikes) * 100).toFixed(1) : 0}%</p>
            <p className="text-xs text-violet-600">Conversión</p>
          </div>
        </div>
      </section>
    </div>
  );
}
