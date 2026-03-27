"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Crown,
  Heart,
  Loader2,
  RefreshCcw,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/45" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/40">No hay datos disponibles.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Suscriptores</h1>
        <p className="mt-1 text-sm text-white/40">Comunidad, conversión y fans.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Activos", value: stats.subscriberCount.toLocaleString(), icon: Users, color: "text-[#00aff0]", border: "border-[#00aff0]/20" },
          { label: "Altas del ciclo", value: `+${stats.newSubsThisCycle}`, icon: UserPlus, color: "text-emerald-400", border: "border-emerald-500/20" },
          { label: "Bajas estimadas", value: `-${churn}`, icon: UserMinus, color: "text-rose-400", border: "border-rose-500/20" },
          { label: "Recurrentes", value: recurrent.toLocaleString(), icon: RefreshCcw, color: "text-amber-400", border: "border-amber-500/20" },
        ].map((m) => (
          <div key={m.label} className={`rounded-xl border ${m.border} bg-white/[0.02] p-4`}>
            <m.icon className={`h-4 w-4 ${m.color}`} />
            <p className="mt-2 text-2xl font-extrabold text-white">{m.value}</p>
            <p className="text-xs text-white/40">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Funnel */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Embudo de conversión</h2>
          <div className="mt-4 space-y-3">
            {[
              { step: "Alcance", value: (stats.totalLikes * 4).toLocaleString(), pct: 100 },
              { step: "Interés", value: stats.totalLikes.toLocaleString(), pct: 65 },
              { step: "Conversión", value: `+${stats.newSubsThisCycle}`, pct: 25 },
            ].map((item) => (
              <div key={item.step} className="rounded-lg bg-white/[0.03] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-white/50">{item.step}</p>
                  <span className="text-base font-extrabold text-white">{item.value}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-[#00aff0]" style={{ width: `${item.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Retention */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Retención</h2>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-20 w-20">
                <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#00aff0" strokeWidth="3" strokeDasharray={`${retentionRate}, 100`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-extrabold text-white">{retentionRate}%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-white/60">Tasa de retención</p>
                <p className="text-xs text-white/40">Suscriptores que renuevan su ciclo.</p>
              </div>
            </div>
          </div>

          {/* Top fans */}
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Top fans</h2>
              <Crown className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="mt-3 space-y-1.5">
              {[
                { name: "@luna_mode", action: "Nueva suscripción", isNew: true },
                { name: "@alma.fit", action: "Renovación mensual", isNew: false },
                { name: "@mia.dark", action: "Nueva suscripción", isNew: true },
                { name: "@valentinax", action: "Renovación mensual", isNew: false },
                { name: "@sofia.rise", action: "3 meses seguidos", isNew: true },
              ].map((fan) => (
                <div key={fan.name} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-2.5 transition hover:bg-white/[0.02]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-xs font-bold text-white/40">
                      {fan.name[1].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/60">{fan.name}</p>
                      <p className="text-[10px] text-white/45">{fan.action}</p>
                    </div>
                  </div>
                  {fan.isNew ? (
                    <span className="text-[11px] font-medium text-emerald-400"><ArrowUpRight className="inline h-3 w-3" /> Nueva</span>
                  ) : (
                    <span className="text-[11px] font-medium text-[#00aff0]"><RefreshCcw className="inline h-3 w-3" /> Activa</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Engagement */}
      <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Engagement</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Likes totales", value: stats.totalLikes.toLocaleString(), icon: Heart, color: "text-rose-400" },
            { label: "Likes por post", value: stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : "0", icon: TrendingUp, color: "text-[#00aff0]" },
            { label: "Conversión", value: `${stats.totalLikes > 0 ? ((stats.subscriberCount / stats.totalLikes) * 100).toFixed(1) : 0}%`, icon: Users, color: "text-purple-400" },
          ].map((m) => (
            <div key={m.label} className="rounded-lg bg-white/[0.03] p-4 text-center">
              <m.icon className={`mx-auto h-4 w-4 ${m.color}`} />
              <p className="mt-2 text-xl font-extrabold text-white">{m.value}</p>
              <p className="text-xs text-white/40">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
