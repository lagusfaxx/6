"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  DollarSign,
  FileStack,
  Heart,
  Loader2,
  Plus,
  Sparkles,
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

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" /></div>;
  if (!stats) return <div className="py-24 text-center text-slate-500">No eres creadora aún.</div>;

  const engagementRate = stats.totalPosts > 0 ? (stats.totalLikes / stats.totalPosts).toFixed(1) : "0";
  const growthRate = stats.subscriberCount > 0 ? ((stats.newSubsThisCycle / stats.subscriberCount) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      {/* Welcome banner */}
      <section className="overflow-hidden rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-500 via-rose-500 to-orange-400 p-6 text-white shadow-xl shadow-fuchsia-200/30 lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Creator Studio
            </div>
            <h1 className="mt-3 text-2xl font-black lg:text-3xl">Resumen de negocio</h1>
            <p className="mt-1 text-sm text-white/80">Tu centro de control diario para publicar, crecer y monetizar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/umate/account/content" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-fuchsia-700 shadow-lg transition hover:shadow-xl">
              <Plus className="h-4 w-4" /> Nueva publicación
            </Link>
            <Link href="/umate/account/wallet" className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20">
              <Wallet className="h-4 w-4" /> Ver ingresos
            </Link>
          </div>
        </div>
      </section>

      {/* Financial summary */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100">
              <DollarSign className="h-5 w-5 text-emerald-700" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Disponible</p>
          </div>
          <p className="mt-3 text-3xl font-black text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-emerald-600">Listo para retirar</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <CalendarClock className="h-5 w-5 text-amber-700" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Retenido</p>
          </div>
          <p className="mt-3 text-3xl font-black text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-amber-600">En período de retención</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
              <TrendingUp className="h-5 w-5 text-slate-700" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total histórico</p>
          </div>
          <p className="mt-3 text-3xl font-black text-slate-900">${stats.totalEarned.toLocaleString("es-CL")}</p>
          <p className="mt-1 text-xs text-slate-500">Acumulado total</p>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Suscriptoras activas", value: stats.subscriberCount.toLocaleString(), icon: Users, color: "text-fuchsia-600", bg: "bg-fuchsia-50" },
          { label: "Nuevas del ciclo", value: `+${stats.newSubsThisCycle}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Publicaciones", value: stats.totalPosts.toLocaleString(), icon: FileStack, color: "text-sky-600", bg: "bg-sky-50" },
          { label: "Likes totales", value: stats.totalLikes.toLocaleString(), icon: Heart, color: "text-rose-500", bg: "bg-rose-50" },
        ].map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${metric.bg}`}>
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </div>
            <p className="mt-3 text-2xl font-black text-slate-900">{metric.value}</p>
            <p className="text-xs text-slate-500">{metric.label}</p>
          </div>
        ))}
      </section>

      {/* Two columns */}
      <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Performance */}
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Rendimiento del ciclo</h2>
            <Link href="/umate/account/stats" className="inline-flex items-center gap-1 text-xs font-semibold text-fuchsia-700">
              Ver analytics <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            {[
              { label: "Engagement por post", value: `${engagementRate} likes`, pct: Math.min(100, parseFloat(engagementRate) * 5) },
              { label: "Crecimiento del ciclo", value: `${growthRate}%`, pct: Math.min(100, parseFloat(growthRate) * 5) },
              { label: "Tasa de retención", value: `${Math.max(72, 100 - Math.round(stats.newSubsThisCycle * 0.28 / Math.max(stats.subscriberCount, 1) * 100))}%`, pct: 72 },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{m.label}</span>
                  <span className="font-bold text-slate-900">{m.value}</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500" style={{ width: `${m.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-amber-500" />
              <p className="text-slate-700">
                <strong>+{stats.newSubsThisCycle}</strong> nuevas suscriptoras este ciclo. Buen momento para publicar contenido premium.
              </p>
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Acciones rápidas</h2>
            <div className="mt-3 space-y-2">
              {[
                { href: "/umate/account/content", label: "Crear publicación", desc: "Sube contenido y programa tu siguiente pieza", icon: Plus, color: "text-fuchsia-600" },
                { href: "/umate/account/subscribers", label: "Gestionar comunidad", desc: "Detecta altas, bajas y fans top", icon: Users, color: "text-sky-600" },
                { href: "/umate/account/stats", label: "Analizar rendimiento", desc: "Métricas de conversión y retención", icon: BarChart3, color: "text-indigo-600" },
                { href: "/umate/account/wallet", label: "Solicitar retiro", desc: "Retira tu saldo disponible", icon: Wallet, color: "text-emerald-600" },
              ].map((action) => (
                <Link key={action.href} href={action.href} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-fuchsia-100 hover:bg-fuchsia-50/30">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                    <action.icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-700">{action.label}</p>
                    <p className="text-[11px] text-slate-500">{action.desc}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              ))}
            </div>
          </div>

          {pendingItems.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <AlertCircle className="h-4 w-4" /> Pendientes ({pendingItems.length})
              </div>
              <div className="mt-3 space-y-2">
                {pendingItems.map((item) => (
                  <Link key={item.label} href={item.href} className="flex items-center justify-between rounded-lg bg-amber-100/50 px-3 py-2 text-sm text-amber-800 transition hover:bg-amber-100">
                    {item.label}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
