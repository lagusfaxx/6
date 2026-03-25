"use client";

import { useEffect, useState } from "react";
import { Loader2, Users, TrendingUp, Heart } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = { subscriberCount: number; newSubsThisCycle: number; totalLikes: number; totalPosts: number };

export default function SubscribersPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/umate/creator/stats").then((d) => setStats(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-20 text-center text-slate-500">No hay datos disponibles.</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-6">
      <h1 className="text-2xl font-black text-slate-900">Suscriptores</h1>
      <p className="text-sm text-slate-500">Vista de comunidad para medir crecimiento y engagement de tu audiencia.</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5"><Users className="h-4 w-4 text-fuchsia-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.subscriberCount.toLocaleString()}</p><p className="text-xs text-slate-500">Activos</p></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5"><TrendingUp className="h-4 w-4 text-amber-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.newSubsThisCycle.toLocaleString()}</p><p className="text-xs text-slate-500">Nuevos en el ciclo</p></div>
        <div className="rounded-2xl border border-slate-100 bg-white p-5"><Heart className="h-4 w-4 text-rose-600" /><p className="mt-2 text-2xl font-black text-slate-900">{stats.totalLikes.toLocaleString()}</p><p className="text-xs text-slate-500">Likes acumulados</p></div>
      </div>
    </div>
  );
}
