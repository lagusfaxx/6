"use client";

import { useEffect, useState } from "react";
import { Users, Heart, Eye, FileText, TrendingUp, Loader2 } from "lucide-react";
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /></div>;
  if (!stats) return <div className="py-20 text-center text-white/40">No eres creadora aún.</div>;

  const metrics = [
    { label: "Suscriptores activos", value: stats.subscriberCount, icon: Users, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/15" },
    { label: "Nuevos este ciclo", value: stats.newSubsThisCycle, icon: TrendingUp, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/15" },
    { label: "Publicaciones", value: stats.totalPosts, icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/15" },
    { label: "Likes totales", value: stats.totalLikes, icon: Heart, color: "text-pink-400", bg: "bg-pink-500/10 border-pink-500/15" },
    { label: "Ingresos totales", value: `$${stats.totalEarned.toLocaleString("es-CL")}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/15" },
    { label: "Disponible para retiro", value: `$${stats.availableBalance.toLocaleString("es-CL")}`, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/15" },
  ];

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <h1 className="text-xl font-bold tracking-tight">Estadísticas</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className={`rounded-2xl border ${m.bg} p-5`}>
            <m.icon className={`h-5 w-5 ${m.color}`} />
            <p className="mt-3 text-2xl font-bold">{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
            <p className="mt-0.5 text-[11px] text-white/40">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
