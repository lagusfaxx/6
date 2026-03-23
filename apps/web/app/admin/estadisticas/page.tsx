"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";

type Analytics = {
  period: string;
  visits: {
    total: number;
    today: number;
    uniqueVisitors: number;
    topPages: { path: string; count: number }[];
    daily: { day: string; count: number }[];
  };
  users: {
    total: number;
    professionals: number;
    newToday: number;
    activeToday: number;
    dailyNew: { day: string; count: number }[];
    profilesWithoutPhotos: number;
    inactiveProfiles: number;
  };
  actions: {
    top: { action: string; count: number }[];
  };
  interactions: {
    messages: number;
    videocallBookings: number;
    serviceRequests: number;
    favorites: number;
  };
  locations: {
    cities: { city: string; count: number }[];
    countries: { country: string; count: number }[];
  };
};

const ACTION_LABELS: Record<string, string> = {
  view_profile: "Ver perfil",
  send_message: "Enviar mensaje",
  book_videocall: "Agendar videollamada",
  favorite: "Agregar favorito",
  search: "Búsqueda",
  view_directory: "Ver directorio",
  contact_form: "Formulario contacto",
  book_encounter: "Solicitar encuentro",
  view_story: "Ver story",
  share_profile: "Compartir perfil",
};

export default function AdminEstadisticas() {
  const { me, loading } = useMe();
  const isAdmin = (me?.user?.role ?? "").toUpperCase() === "ADMIN";
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setError(false);
    apiFetch<Analytics>(`/admin/analytics?period=${period}`)
      .then(setData)
      .catch(() => setError(true));
  }, [isAdmin, period]);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 text-white">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <Link href="/admin" className="text-sm text-white/50 hover:text-white/70 transition">
            ← Centro de Control
          </Link>
          <h1 className="text-2xl font-semibold mt-1">Estadísticas</h1>
        </div>
        <div className="flex gap-2">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                period === p
                  ? "bg-fuchsia-600 text-white"
                  : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
              }`}
            >
              {p === "24h" ? "24 horas" : p === "7d" ? "7 días" : "30 días"}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 mb-6">
          Error cargando estadísticas. Verifica que las tablas de analytics existan en la base de datos.
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <MetricCard label="Visitas totales" value={data.visits.total} sub={`Hoy: ${data.visits.today}`} color="fuchsia" />
            <MetricCard label="Visitantes únicos" value={data.visits.uniqueVisitors} color="violet" />
            <MetricCard label="Usuarios totales" value={data.users.total} sub={`Profesionales: ${data.users.professionals}`} color="blue" />
            <MetricCard label="Usuarios activos hoy" value={data.users.activeToday} sub={`Nuevos hoy: ${data.users.newToday}`} color="emerald" />
          </div>

          {/* Interactions */}
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-[0.18em] text-white/60 mb-3">Interacciones</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard label="Mensajes" value={data.interactions.messages} color="blue" />
              <MetricCard label="Videollamadas agendadas" value={data.interactions.videocallBookings} color="fuchsia" />
              <MetricCard label="Solicitudes de encuentro" value={data.interactions.serviceRequests} color="violet" />
              <MetricCard label="Favoritos agregados" value={data.interactions.favorites} color="pink" />
            </div>
          </section>

          {/* Profile health */}
          <section className="mb-8">
            <h2 className="text-sm uppercase tracking-[0.18em] text-white/60 mb-3">Salud de perfiles</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <MetricCard
                label="Perfiles sin fotos"
                value={data.users.profilesWithoutPhotos}
                color="amber"
              />
              <MetricCard
                label="Perfiles inactivos (48h+)"
                value={data.users.inactiveProfiles}
                color="red"
              />
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Daily views chart */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold mb-4">Visitas diarias</h3>
              {data.visits.daily.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos aún</p>
              ) : (
                <BarChart data={data.visits.daily} color="#a855f7" />
              )}
            </div>

            {/* Daily new users */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold mb-4">Nuevos usuarios por día</h3>
              {data.users.dailyNew.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos aún</p>
              ) : (
                <BarChart data={data.users.dailyNew} color="#3b82f6" />
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Top pages */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold mb-4">Páginas más visitadas</h3>
              <RankingList items={data.visits.topPages.map((p) => ({ label: p.path, value: p.count }))} />
            </div>

            {/* Top actions */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold mb-4">Acciones más usadas</h3>
              {data.actions.top.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos de acciones aún. Las acciones se rastrean automáticamente.</p>
              ) : (
                <RankingList
                  items={data.actions.top.map((a) => ({
                    label: ACTION_LABELS[a.action] || a.action,
                    value: a.count,
                  }))}
                />
              )}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-8">
            {/* Locations */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold mb-4">Ciudades</h3>
              {data.locations.cities.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos de ubicación. Se obtienen de los headers del CDN (Cloudflare/Vercel).</p>
              ) : (
                <RankingList items={data.locations.cities.map((c) => ({ label: c.city || "Desconocida", value: c.count }))} />
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <h3 className="text-lg font-semibold mb-4">Países</h3>
              {data.locations.countries.length === 0 ? (
                <p className="text-white/40 text-sm">Sin datos de ubicación.</p>
              ) : (
                <RankingList items={data.locations.countries.map((c) => ({ label: c.country || "Desconocido", value: c.count }))} />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Components ─── */

function MetricCard({ label, value, sub, color = "fuchsia" }: { label: string; value: number; sub?: string; color?: string }) {
  const colorMap: Record<string, string> = {
    fuchsia: "border-fuchsia-500/20 bg-fuchsia-500/5",
    violet: "border-violet-500/20 bg-violet-500/5",
    blue: "border-blue-500/20 bg-blue-500/5",
    emerald: "border-emerald-500/20 bg-emerald-500/5",
    pink: "border-pink-500/20 bg-pink-500/5",
    amber: "border-amber-500/20 bg-amber-500/5",
    red: "border-red-500/20 bg-red-500/5",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 ${colorMap[color] || colorMap.fuchsia}`}>
      <div className="text-2xl font-semibold text-white">{value.toLocaleString("es-CL")}</div>
      <div className="text-xs text-white/65">{label}</div>
      {sub && <div className="text-[11px] text-white/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function BarChart({ data, color }: { data: { day: string; count: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map((d) => {
        const h = Math.max((d.count / max) * 100, 2);
        const dayLabel = new Date(d.day + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
        return (
          <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] text-white/40">{d.count}</span>
            <div
              className="w-full min-w-[8px] rounded-t-md transition-all"
              style={{ height: `${h}%`, backgroundColor: color, opacity: 0.8 }}
            />
            <span className="text-[8px] text-white/30 truncate w-full text-center">{dayLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

function RankingList({ items }: { items: { label: string; value: number }[] }) {
  if (!items.length) return <p className="text-white/40 text-sm">Sin datos.</p>;
  const max = items[0]?.value || 1;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={`${item.label}-${i}`} className="relative">
          <div
            className="absolute inset-0 rounded-lg bg-fuchsia-500/10"
            style={{ width: `${Math.max((item.value / max) * 100, 5)}%` }}
          />
          <div className="relative flex items-center justify-between px-3 py-1.5">
            <span className="text-sm text-white/80 truncate max-w-[70%]">{item.label}</span>
            <span className="text-sm font-medium text-white/60">{item.value.toLocaleString("es-CL")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
