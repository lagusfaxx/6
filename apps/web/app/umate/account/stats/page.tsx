"use client";

import { useEffect, useState } from "react";
import { Users, Heart, FileText, TrendingUp, DollarSign, Loader2, Wallet } from "lucide-react";
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400/60" /></div>;
  if (!stats) return <div className="py-20 text-center text-white/40">No eres creadora aún.</div>;

  const metrics = [
    { label: "Suscriptores activos", value: stats.subscriberCount, icon: Users, color: "text-rose-400", border: "border-rose-500/15", bg: "from-rose-500/[0.06]" },
    { label: "Nuevos este ciclo", value: stats.newSubsThisCycle, icon: TrendingUp, color: "text-amber-400", border: "border-amber-500/15", bg: "from-amber-500/[0.06]" },
    { label: "Publicaciones", value: stats.totalPosts, icon: FileText, color: "text-blue-400", border: "border-blue-500/15", bg: "from-blue-500/[0.06]" },
    { label: "Likes totales", value: stats.totalLikes, icon: Heart, color: "text-pink-400", border: "border-pink-500/15", bg: "from-pink-500/[0.06]" },
    { label: "Ingresos totales", value: `$${stats.totalEarned.toLocaleString("es-CL")}`, icon: DollarSign, color: "text-emerald-400", border: "border-emerald-500/15", bg: "from-emerald-500/[0.06]" },
    { label: "Disponible para retiro", value: `$${stats.availableBalance.toLocaleString("es-CL")}`, icon: Wallet, color: "text-emerald-400", border: "border-emerald-500/15", bg: "from-emerald-500/[0.06]" },
  ];

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Estadísticas</h1>
        <p className="text-xs text-white/25 mt-0.5">Métricas de rendimiento</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-2xl border ${m.border} bg-gradient-to-br ${m.bg} to-transparent p-5`}>
            <m.icon className={`h-5 w-5 ${m.color}`} />
            <p className="mt-3 text-2xl font-extrabold">{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
            <p className="mt-1 text-[11px] text-white/30">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
