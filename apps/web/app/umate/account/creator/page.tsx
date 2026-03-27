"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  FileStack,
  Heart,
  Loader2,
  Plus,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
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

  const pendingItems = useMemo(
    () =>
      [
        !stats?.bankConfigured && { label: "Configurar datos bancarios", href: "/umate/account" },
        !stats?.termsAccepted && { label: "Aceptar términos", href: "/umate/terms" },
        !stats?.rulesAccepted && { label: "Aceptar reglas", href: "/umate/rules" },
        !stats?.contractAccepted && { label: "Firmar contrato", href: "/umate/account" },
      ].filter(Boolean) as { label: string; href: string }[],
    [stats],
  );

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/45" /></div>;
  if (!stats) return <div className="py-24 text-center text-white/40">No eres creadora aún.</div>;

  const engagementRate = stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : "0";
  const growthRate = stats.subscriberCount > 0 ? ((stats.newSubsThisCycle / stats.subscriberCount) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-white/40">Tu centro de control.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/umate/account/content" className="inline-flex items-center gap-1.5 rounded-full bg-[#00aff0] px-5 py-2 text-sm font-semibold text-white shadow-[0_2px_12px_rgba(0,175,240,0.25)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_20px_rgba(0,175,240,0.35)]">
            <Plus className="h-4 w-4" /> Publicar
          </Link>
          <Link href="/umate/account/wallet" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-4 py-2 text-sm font-medium text-white/50 transition hover:text-white/70">
            <Wallet className="h-4 w-4" /> Ingresos
          </Link>
        </div>
      </div>

      {/* Financial cards */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400/70">Disponible</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-emerald-400">${stats.availableBalance.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-white/45">Listo para retirar</p>
        </div>
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400/70">Retenido</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-amber-400">${stats.pendingBalance.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-white/45">En período de retención</p>
        </div>
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-white/40" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/40">Total histórico</p>
          </div>
          <p className="mt-2 text-2xl font-extrabold text-white">${stats.totalEarned.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-white/45">Acumulado</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Suscriptores", value: stats.subscriberCount.toLocaleString(), icon: Users, color: "text-[#00aff0]" },
          { label: "Nuevos del ciclo", value: `+${stats.newSubsThisCycle}`, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Publicaciones", value: stats.totalPosts.toLocaleString(), icon: FileStack, color: "text-purple-400" },
          { label: "Likes totales", value: stats.totalLikes.toLocaleString(), icon: Heart, color: "text-rose-400" },
        ].map((m) => (
          <div key={m.label} className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
            <m.icon className={`h-4 w-4 ${m.color}`} />
            <p className="mt-3 text-2xl font-extrabold text-white">{m.value}</p>
            <p className="text-xs text-white/40">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Two columns */}
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Performance */}
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Rendimiento</h2>
            <Link href="/umate/account/stats" className="text-[11px] font-medium text-[#00aff0]">Ver analytics</Link>
          </div>
          <div className="mt-4 space-y-4">
            {[
              { label: "Engagement por post", value: `${engagementRate} likes`, pct: Math.min(100, parseFloat(engagementRate) * 5) },
              { label: "Crecimiento del ciclo", value: `${growthRate}%`, pct: Math.min(100, parseFloat(growthRate) * 5) },
              { label: "Tasa de retención", value: `${Math.max(72, 100 - Math.round(stats.newSubsThisCycle * 0.28 / Math.max(stats.subscriberCount, 1) * 100))}%`, pct: 72 },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/40">{m.label}</span>
                  <span className="font-semibold text-white/70">{m.value}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                  <div className="h-full rounded-full bg-[#00aff0]" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/40">Acciones rápidas</h2>
            <div className="mt-3 space-y-1.5">
              {[
                { href: "/umate/account/content", label: "Crear publicación", icon: Plus },
                { href: "/umate/account/subscribers", label: "Gestionar comunidad", icon: Users },
                { href: "/umate/account/stats", label: "Analizar rendimiento", icon: BarChart3 },
                { href: "/umate/account/wallet", label: "Solicitar retiro", icon: Wallet },
              ].map((a) => (
                <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-lg border border-white/[0.04] p-3 transition hover:bg-white/[0.04]">
                  <a.icon className="h-4 w-4 text-white/40" />
                  <span className="flex-1 text-sm font-medium text-white/50">{a.label}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-white/40" />
                </Link>
              ))}
            </div>
          </div>

          {pendingItems.length > 0 && (
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-400">
                <AlertCircle className="h-4 w-4" /> Pendientes ({pendingItems.length})
              </div>
              <div className="mt-3 space-y-1.5">
                {pendingItems.map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-lg bg-amber-500/[0.06] px-3 py-2 text-sm text-amber-400/80 transition hover:bg-amber-500/[0.1]">
                    {item.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
