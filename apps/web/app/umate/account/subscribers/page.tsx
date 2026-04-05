"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Crown,
  Gem,
  Heart,
  Loader2,
  Medal,
  RefreshCcw,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../../lib/api";

type Stats = { subscriberCount: number; newSubsThisCycle: number; totalLikes: number; totalPosts: number };

type Subscriber = {
  id: string;
  activatedAt: string;
  expiresAt: string;
  tier: "SILVER" | "GOLD" | "DIAMOND";
  planName: string;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

const TIER_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Crown }> = {
  DIAMOND: { label: "Diamond", color: "text-purple-300", bg: "bg-purple-500/15", border: "border-purple-500/25", icon: Gem },
  GOLD: { label: "Gold", color: "text-amber-300", bg: "bg-amber-500/15", border: "border-amber-500/25", icon: Crown },
  SILVER: { label: "Silver", color: "text-white/60", bg: "bg-white/10", border: "border-white/15", icon: Medal },
};

export default function SubscribersPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<string>("");

  useEffect(() => {
    Promise.all([
      apiFetch<Stats>("/umate/creator/stats").catch(() => null),
      apiFetch<{ subscribers: Subscriber[] }>("/umate/creator/subscribers").catch(() => null),
    ]).then(([s, subData]) => {
      if (s) setStats(s);
      setSubscribers(subData?.subscribers || []);
      setLoading(false);
    });
  }, []);

  const churn = useMemo(() => Math.max(Math.round((stats?.newSubsThisCycle || 0) * 0.28), 0), [stats?.newSubsThisCycle]);
  const retentionRate = useMemo(() => {
    if (!stats?.subscriberCount) return 0;
    return Math.round(((stats.subscriberCount - churn) / stats.subscriberCount) * 100);
  }, [stats, churn]);

  const tierCounts = useMemo(() => {
    const counts = { SILVER: 0, GOLD: 0, DIAMOND: 0 };
    for (const s of subscribers) counts[s.tier] = (counts[s.tier] || 0) + 1;
    return counts;
  }, [subscribers]);

  const filtered = useMemo(() => {
    if (!tierFilter) return subscribers;
    return subscribers.filter((s) => s.tier === tierFilter);
  }, [subscribers, tierFilter]);

  if (loading) return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/40">No hay datos disponibles.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Suscriptores</h1>
        <p className="mt-1 text-sm text-white/30">Comunidad, planes y fans.</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Activos", value: stats.subscriberCount.toLocaleString(), icon: Users, color: "text-[#00aff0]", border: "border-[#00aff0]/20" },
          { label: "Altas del ciclo", value: `+${stats.newSubsThisCycle}`, icon: UserPlus, color: "text-emerald-400", border: "border-emerald-500/20" },
          { label: "Bajas estimadas", value: `-${churn}`, icon: UserMinus, color: "text-rose-400", border: "border-rose-500/20" },
          { label: "Retención", value: `${retentionRate}%`, icon: RefreshCcw, color: "text-amber-400", border: "border-amber-500/20" },
        ].map((m) => (
          <div key={m.label} className={`rounded-xl border ${m.border} bg-white/[0.015] p-4`}>
            <m.icon className={`h-4 w-4 ${m.color}`} />
            <p className="mt-2 text-2xl font-extrabold text-white">{m.value}</p>
            <p className="text-xs text-white/40">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Tier distribution */}
      <div className="grid gap-3 sm:grid-cols-3">
        {(["DIAMOND", "GOLD", "SILVER"] as const).map((tier) => {
          const cfg = TIER_CONFIG[tier];
          const Icon = cfg.icon;
          return (
            <div key={tier} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4 flex items-center gap-3`}>
              <Icon className={`h-5 w-5 ${cfg.color}`} />
              <div>
                <p className="text-xl font-extrabold text-white">{tierCounts[tier]}</p>
                <p className={`text-xs ${cfg.color}`}>{cfg.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subscriber list */}
      <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Suscriptores activos</h2>
          <span className="text-[11px] text-white/40">{filtered.length} de {subscribers.length}</span>
        </div>

        {/* Tier filter */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            { key: "", label: "Todos" },
            { key: "DIAMOND", label: "Diamond" },
            { key: "GOLD", label: "Gold" },
            { key: "SILVER", label: "Silver" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setTierFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                tierFilter === f.key
                  ? "bg-[#00aff0]/15 text-[#00aff0] border border-[#00aff0]/25"
                  : "text-white/40 hover:text-white/50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-sm text-white/45 py-6">Sin suscriptores aún.</p>
        )}

        <div className="space-y-1.5">
          {filtered.map((sub) => {
            const cfg = TIER_CONFIG[sub.tier];
            const Icon = cfg.icon;
            const isNew = new Date(sub.activatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return (
              <div key={sub.id} className="flex items-center justify-between rounded-lg border border-white/[0.03] p-3 transition hover:bg-white/[0.015]">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                    {sub.user.avatarUrl ? (
                      <img src={resolveMediaUrl(sub.user.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-bold text-white/40">
                        {(sub.user.displayName || sub.user.username)[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/70 truncate">
                        {sub.user.displayName || `@${sub.user.username}`}
                      </p>
                      {isNew && (
                        <span className="shrink-0 text-[11px] font-medium text-emerald-400 flex items-center gap-0.5">
                          <ArrowUpRight className="h-2.5 w-2.5" /> Nueva
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40">@{sub.user.username} · desde {new Date(sub.activatedAt).toLocaleDateString("es-CL")}</p>
                  </div>
                </div>
                <div className={`shrink-0 flex items-center gap-1.5 rounded-full ${cfg.bg} border ${cfg.border} px-2.5 py-1`}>
                  <Icon className={`h-3 w-3 ${cfg.color}`} />
                  <span className={`text-[11px] font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Engagement */}
      <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
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
