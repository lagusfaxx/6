"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Heart, FileText, TrendingUp, DollarSign, AlertCircle, ChevronRight, Loader2, Plus, Wallet } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

type Stats = {
  subscriberCount: number;
  newSubsThisCycle: number;
  totalPosts: number;
  totalLikes: number;
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
  status: string;
  bankConfigured: boolean;
  termsAccepted: boolean;
  rulesAccepted: boolean;
  contractAccepted: boolean;
  ledger: { id: string; type: string; grossAmount: number; creatorPayout: number; createdAt: string; description: string | null }[];
};

export default function CreatorDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Stats>("/umate/creator/stats")
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400/60" /></div>;
  if (!stats) return <div className="py-20 text-center text-white/40">No eres creadora aún. <Link href="/umate/onboarding" className="text-rose-400 font-medium">Crear cuenta</Link></div>;

  const pendingItems = [
    !stats.bankConfigured && "Configurar datos bancarios",
    !stats.termsAccepted && "Aceptar términos",
    !stats.rulesAccepted && "Aceptar reglas",
    !stats.contractAccepted && "Aceptar contrato",
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-xs text-white/25 mt-0.5">Panel de creadora</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${
          stats.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}>
          {stats.status === "ACTIVE" ? "Activa" : stats.status}
        </span>
      </div>

      {/* Pending items */}
      {pendingItems.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 space-y-2">
          <p className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <AlertCircle className="h-4 w-4" /> Completa tu perfil
          </p>
          {pendingItems.map((item) => (
            <Link key={item as string} href="/umate/onboarding" className="flex items-center gap-2 text-xs text-white/40 hover:text-white/60 transition">
              <ChevronRight className="h-3 w-3" /> {item}
            </Link>
          ))}
        </div>
      )}

      {/* Earnings overview — prominent like OnlyFans */}
      <div className="rounded-2xl border border-white/[0.07] bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-6">
        <h2 className="mb-4 text-sm font-bold text-white/50">Ingresos</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-emerald-300">${stats.availableBalance.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-white/30 mt-1">Disponible</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-amber-300">${stats.pendingBalance.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-white/30 mt-1">Retenido</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold">${stats.totalEarned.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-white/30 mt-1">Total ganado</p>
          </div>
        </div>
        <Link href="/umate/account/wallet" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] py-2.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/[0.1]">
          <Wallet className="h-3.5 w-3.5" /> Ver billetera y retiros
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Suscriptores", value: stats.subscriberCount, icon: Users, color: "text-rose-400" },
          { label: "Nuevos este mes", value: stats.newSubsThisCycle, icon: TrendingUp, color: "text-amber-400" },
          { label: "Publicaciones", value: stats.totalPosts, icon: FileText, color: "text-blue-400" },
          { label: "Likes totales", value: stats.totalLikes, icon: Heart, color: "text-pink-400" },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <p className="mt-2 text-2xl font-extrabold">{c.value.toLocaleString()}</p>
            <p className="text-[10px] text-white/30 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Recent ledger */}
      {stats.ledger.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-bold">Movimientos recientes</h2>
          <div className="space-y-2.5">
            {stats.ledger.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-xs border-b border-white/[0.04] pb-2.5 last:border-0">
                <div>
                  <p className="text-white/50">{entry.description || entry.type}</p>
                  <p className="text-[10px] text-white/20">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
                <span className="font-bold text-emerald-300">+${entry.creatorPayout.toLocaleString("es-CL")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/umate/account/content" className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10">
            <Plus className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <p className="text-sm font-bold">Publicar</p>
            <p className="text-[10px] text-white/25">Nuevo contenido</p>
          </div>
        </Link>
        <Link href="/umate/account/stats" className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:bg-white/[0.04]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
            <TrendingUp className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <p className="text-sm font-bold">Estadísticas</p>
            <p className="text-[10px] text-white/25">Ver métricas</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
