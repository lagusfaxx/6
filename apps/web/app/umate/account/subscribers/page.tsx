"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  Heart,
  Loader2,
  RefreshCcw,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../../lib/api";

type Stats = { subscriberCount: number; newSubsThisCycle: number; totalLikes: number; totalPosts: number };

type Subscriber = {
  id: string;
  activatedAt: string;
  expiresAt: string;
  priceCLP: number;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
  cancelAtPeriodEnd: boolean;
  cardBrand: string | null;
  cardLast4: string | null;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null };
};

export default function SubscribersPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

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

  const churn = useMemo(
    () => subscribers.filter((s) => s.status === "CANCELLED" || s.cancelAtPeriodEnd).length,
    [subscribers],
  );
  const retentionRate = useMemo(() => {
    if (!stats?.subscriberCount) return 0;
    return Math.round(((stats.subscriberCount - churn) / stats.subscriberCount) * 100);
  }, [stats, churn]);

  const mrr = useMemo(
    () => subscribers.filter((s) => s.status === "ACTIVE").reduce((sum, s) => sum + s.priceCLP, 0),
    [subscribers],
  );

  const filtered = useMemo(() => {
    if (!statusFilter) return subscribers;
    if (statusFilter === "ACTIVE") return subscribers.filter((s) => s.status === "ACTIVE" && !s.cancelAtPeriodEnd);
    if (statusFilter === "CANCELLED") return subscribers.filter((s) => s.status === "CANCELLED" || s.cancelAtPeriodEnd);
    return subscribers;
  }, [subscribers, statusFilter]);

  if (loading) return <div className="flex flex-col items-center justify-center py-24 gap-3"><Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/40">No hay datos disponibles.</div>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Suscriptores</h1>
        <p className="mt-1 text-sm text-white/30">Comunidad y fans con suscripción directa (PAC).</p>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Activos", value: stats.subscriberCount.toLocaleString(), icon: Users, color: "text-[#00aff0]", border: "border-[#00aff0]/20" },
          { label: "Nuevos (mes)", value: `+${stats.newSubsThisCycle}`, icon: UserPlus, color: "text-emerald-400", border: "border-emerald-500/20" },
          { label: "Cancelando", value: `${churn}`, icon: UserMinus, color: "text-rose-400", border: "border-rose-500/20" },
          { label: "Retención", value: `${retentionRate}%`, icon: RefreshCcw, color: "text-amber-400", border: "border-amber-500/20" },
        ].map((m) => (
          <div key={m.label} className={`rounded-xl border ${m.border} bg-white/[0.015] p-4`}>
            <m.icon className={`h-4 w-4 ${m.color}`} />
            <p className="mt-2 text-2xl font-extrabold text-white">{m.value}</p>
            <p className="text-xs text-white/40">{m.label}</p>
          </div>
        ))}
      </div>

      {/* MRR card */}
      <div className="rounded-2xl border border-[#00aff0]/15 bg-gradient-to-br from-[#00aff0]/[0.06] via-[#00aff0]/[0.02] to-transparent p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Ingresos recurrentes mensuales (MRR)</p>
            <p className="mt-1 text-3xl font-extrabold text-white">${mrr.toLocaleString("es-CL")} <span className="text-sm font-semibold text-white/40">CLP</span></p>
            <p className="mt-1 text-xs text-white/40">Suma de las tarifas de tus suscriptores activos con PAC.</p>
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00aff0]/15">
            <CreditCard className="h-6 w-6 text-[#00aff0]" />
          </div>
        </div>
      </div>

      {/* Subscriber list */}
      <div className="rounded-2xl border border-white/[0.04] bg-white/[0.015] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Suscriptores</h2>
          <span className="text-[11px] text-white/40">{filtered.length} de {subscribers.length}</span>
        </div>

        {/* Status filter */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            { key: "", label: "Todos" },
            { key: "ACTIVE", label: "Activos" },
            { key: "CANCELLED", label: "Cancelando" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                statusFilter === f.key
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
            const isNew = new Date(sub.activatedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const isCancelling = sub.status === "CANCELLED" || sub.cancelAtPeriodEnd;
            return (
              <div key={sub.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.03] p-3 transition hover:bg-white/[0.015]">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
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
                          <ArrowUpRight className="h-2.5 w-2.5" /> Nuevo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-white/40 truncate">
                      @{sub.user.username} · desde {new Date(sub.activatedAt).toLocaleDateString("es-CL")}
                      {sub.cardLast4 ? ` · •• ${sub.cardLast4}` : ""}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span className="text-sm font-extrabold text-white">${sub.priceCLP.toLocaleString("es-CL")}</span>
                  {isCancelling ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      <XCircle className="h-2.5 w-2.5" /> Cancelando
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Activo
                    </span>
                  )}
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
