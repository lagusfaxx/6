"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  CalendarClock,
  Heart,
  Loader2,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
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
    apiFetch<Stats>("/umate/creator/stats").then(setStats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const pendingItems = useMemo(
    () => [
      !stats?.bankConfigured && "Configurar datos bancarios",
      !stats?.termsAccepted && "Aceptar términos",
      !stats?.rulesAccepted && "Aceptar reglas",
      !stats?.contractAccepted && "Aceptar contrato",
    ].filter(Boolean) as string[],
    [stats],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-500" />
      </div>
    );
  }

  if (!stats) return <div className="py-20 text-center text-slate-500">No eres creadora aún.</div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6 py-6">
      <section className="overflow-hidden rounded-3xl border border-fuchsia-100 bg-gradient-to-br from-white via-rose-50 to-orange-50 shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white px-3 py-1 text-[11px] font-semibold text-fuchsia-700">
              <Sparkles className="h-3.5 w-3.5" /> Centro de control
            </p>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Resumen de negocio</h1>
            <p className="mt-2 text-sm text-slate-600">Tu sala de mando diaria para operar, publicar y escalar ingresos.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/umate/account/content" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/25">
                <Plus className="h-4 w-4" /> Publicar ahora
              </Link>
              <Link href="/umate/account/wallet" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">
                <Wallet className="h-4 w-4" /> Revisar ingresos
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/80 bg-white/80 p-4 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Salud del negocio</p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm">
                <span className="text-emerald-700">Disponible</span>
                <strong className="text-emerald-800">${stats.availableBalance.toLocaleString("es-CL")}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm">
                <span className="text-amber-700">Retenido</span>
                <strong className="text-amber-800">${stats.pendingBalance.toLocaleString("es-CL")}</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm">
                <span className="text-slate-600">Total histórico</span>
                <strong className="text-slate-900">${stats.totalEarned.toLocaleString("es-CL")}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Suscriptoras activas", value: stats.subscriberCount, icon: Users, tone: "text-fuchsia-600" },
          { label: "Nuevas del ciclo", value: stats.newSubsThisCycle, icon: TrendingUp, tone: "text-amber-600" },
          { label: "Publicaciones", value: stats.totalPosts, icon: CalendarClock, tone: "text-sky-600" },
          { label: "Likes totales", value: stats.totalLikes, icon: Heart, tone: "text-rose-600" },
        ].map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <metric.icon className={`h-4 w-4 ${metric.tone}`} />
            <p className="mt-3 text-2xl font-black text-slate-900">{metric.value.toLocaleString()}</p>
            <p className="text-xs text-slate-500">{metric.label}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Actividad reciente</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="font-semibold text-slate-700">+{stats.newSubsThisCycle} nuevas suscriptoras en este ciclo.</p>
              <p className="text-xs text-slate-500">Buen momentum para lanzar una pieza premium hoy.</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="font-semibold text-slate-700">{stats.totalPosts} publicaciones activas en biblioteca.</p>
              <p className="text-xs text-slate-500">Ordena por rendimiento en la sección de Contenido.</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="font-semibold text-slate-700">{stats.totalLikes.toLocaleString()} likes acumulados.</p>
              <p className="text-xs text-slate-500">Tu engagement permite probar nuevas series de contenido.</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Acciones rápidas</p>
          <div className="mt-3 space-y-2 text-sm">
            {[
              { href: "/umate/account/content", label: "Crear publicación", desc: "Carga media y programa tu siguiente pieza" },
              { href: "/umate/account/subscribers", label: "Gestionar comunidad", desc: "Detecta altas, bajas y fans top" },
              { href: "/umate/account/stats", label: "Analizar rendimiento", desc: "Revisa conversión y retención" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="block rounded-xl border border-slate-100 p-3 transition hover:bg-slate-50">
                <div className="flex items-center justify-between font-semibold text-slate-700">
                  {item.label}
                  <ArrowUpRight className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.desc}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>

      {pendingItems.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-2 inline-flex items-center gap-2 text-sm font-bold text-amber-800">
            <AlertCircle className="h-4 w-4" /> Pendientes de configuración
          </p>
          <ul className="space-y-1 text-sm text-amber-700">
            {pendingItems.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
