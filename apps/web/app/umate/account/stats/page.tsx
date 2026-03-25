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
    apiFetch<Stats>("/umate/creator/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-20 text-center text-slate-500">No eres creadora aún.</div>;

  const metrics = [
    { label: "Suscriptores", value: stats.subscriberCount, icon: Users },
    { label: "Nuevos", value: stats.newSubsThisCycle, icon: TrendingUp },
    { label: "Publicaciones", value: stats.totalPosts, icon: FileText },
    { label: "Likes", value: stats.totalLikes, icon: Heart },
    { label: "Ingresos", value: `$${stats.totalEarned.toLocaleString("es-CL")}`, icon: DollarSign },
    { label: "Disponible", value: `$${stats.availableBalance.toLocaleString("es-CL")}`, icon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <h1 className="text-2xl font-black text-slate-900">Estadísticas</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <m.icon className="h-4 w-4 text-fuchsia-600" />
            <p className="mt-3 text-2xl font-black text-slate-900">{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
            <p className="text-xs text-slate-500">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
