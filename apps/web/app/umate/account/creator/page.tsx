"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, Heart, FileText, TrendingUp, DollarSign, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
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

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /></div>;
  if (!stats) return <div className="py-20 text-center text-white/40">No eres creadora aún. <Link href="/umate/onboarding" className="text-rose-400">Crear cuenta</Link></div>;

  const cards = [
    { label: "Suscriptores", value: stats.subscriberCount, icon: Users, color: "text-rose-400" },
    { label: "Nuevos este mes", value: stats.newSubsThisCycle, icon: TrendingUp, color: "text-amber-400" },
    { label: "Publicaciones", value: stats.totalPosts, icon: FileText, color: "text-blue-400" },
    { label: "Likes totales", value: stats.totalLikes, icon: Heart, color: "text-pink-400" },
  ];

  const pendingItems = [
    !stats.bankConfigured && "Configurar datos bancarios",
    !stats.termsAccepted && "Aceptar términos",
    !stats.rulesAccepted && "Aceptar reglas",
    !stats.contractAccepted && "Aceptar contrato",
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dashboard creadora</h1>
        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
          stats.status === "ACTIVE" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
        }`}>
          {stats.status}
        </span>
      </div>

      {/* Pending items */}
      {pendingItems.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.05] p-4 space-y-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <AlertCircle className="h-4 w-4" /> Completa tu perfil
          </p>
          {pendingItems.map((item) => (
            <Link key={item as string} href="/umate/onboarding" className="flex items-center gap-2 text-xs text-white/50 hover:text-white/70">
              <ChevronRight className="h-3 w-3" /> {item}
            </Link>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            <c.icon className={`h-4 w-4 ${c.color}`} />
            <p className="mt-2 text-2xl font-bold">{c.value.toLocaleString()}</p>
            <p className="text-[10px] text-white/40">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Earnings */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
        <h2 className="mb-4 text-sm font-semibold">Ingresos</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xl font-bold text-emerald-300">${stats.availableBalance.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-white/40">Disponible</p>
          </div>
          <div>
            <p className="text-xl font-bold text-amber-300">${stats.pendingBalance.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-white/40">Retenido</p>
          </div>
          <div>
            <p className="text-xl font-bold">${stats.totalEarned.toLocaleString("es-CL")}</p>
            <p className="text-[10px] text-white/40">Total ganado</p>
          </div>
        </div>
        <Link href="/umate/account/wallet" className="mt-4 flex items-center justify-center gap-1 text-xs font-medium text-rose-400 hover:text-rose-300">
          <DollarSign className="h-3 w-3" /> Ver billetera y retiros
        </Link>
      </div>

      {/* Recent ledger */}
      {stats.ledger.length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <h2 className="mb-3 text-sm font-semibold">Movimientos recientes</h2>
          <div className="space-y-2">
            {stats.ledger.slice(0, 5).map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-white/60">{entry.description || entry.type}</p>
                  <p className="text-[10px] text-white/30">{new Date(entry.createdAt).toLocaleDateString("es-CL")}</p>
                </div>
                <span className="font-medium text-emerald-300">+${entry.creatorPayout.toLocaleString("es-CL")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/umate/account/content" className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-center transition hover:bg-white/[0.04]">
          <FileText className="mx-auto h-5 w-5 text-white/30" />
          <p className="mt-2 text-xs font-medium">Publicar contenido</p>
        </Link>
        <Link href="/umate/account/stats" className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-center transition hover:bg-white/[0.04]">
          <TrendingUp className="mx-auto h-5 w-5 text-white/30" />
          <p className="mt-2 text-xs font-medium">Ver estadísticas</p>
        </Link>
      </div>
    </div>
  );
}
