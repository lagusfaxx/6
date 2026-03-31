"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  BarChart3,
  BookImage,
  Eye,
  Globe,
  Heart,
  LayoutGrid,
  MapPin,
  MessageSquare,
  MousePointerClick,
  Phone,
  Shield,
  ShieldCheck,
  Store,
  Tag,
  TrendingDown,
  TrendingUp,
  Trash2,
  User,
  UserCheck,
  Users,
  Video,
  Zap,
} from "lucide-react";

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
    whatsappClicks: number;
  };
  whatsapp: {
    total: number;
    topProfiles: { profileId: string; displayName: string; count: number }[];
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
  search: "Busqueda",
  view_directory: "Ver directorio",
  contact_form: "Formulario contacto",
  book_encounter: "Solicitar encuentro",
  view_story: "Ver story",
  share_profile: "Compartir perfil",
  whatsapp_click: "Click WhatsApp",
};

const ACTION_ICONS: Record<string, any> = {
  view_profile: Eye,
  send_message: MessageSquare,
  book_videocall: Video,
  favorite: Heart,
  search: MousePointerClick,
  view_directory: LayoutGrid,
  contact_form: MessageSquare,
  book_encounter: Users,
  view_story: Eye,
  share_profile: Zap,
  whatsapp_click: Phone,
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/estadisticas", label: "Estadisticas", icon: BarChart3 },
  { href: "/admin/verification", label: "Verificaciones", icon: UserCheck },
  { href: "/admin/profiles", label: "Perfiles", icon: Users },
  { href: "/admin/deposits", label: "Depositos", icon: ArrowDownToLine },
  { href: "/admin/withdrawals", label: "Retiros", icon: ArrowUpFromLine },
  { href: "/admin/banners", label: "Banners", icon: BookImage },
  { href: "/admin/pricing", label: "Precios", icon: Tag },
  { href: "/admin/quick-listings", label: "Listados", icon: Store },
  { href: "/admin/moderation", label: "Moderacion", icon: Shield },
  { href: "/admin/privacy-requests", label: "Privacidad", icon: Trash2 },
];

export default function AdminEstadisticas() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const [data, setData] = useState<Analytics | null>(null);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [error, setError] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setError(false);
    setLoadingData(true);
    apiFetch<Analytics>(`/admin/analytics?period=${period}`)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoadingData(false));
  }, [isAdmin, period]);

  const totalInteractions = useMemo(() => {
    if (!data) return 0;
    const i = data.interactions;
    return i.messages + i.videocallBookings + i.serviceRequests + i.favorites + i.whatsappClicks;
  }, [data]);

  const avgDailyVisits = useMemo(() => {
    if (!data || !data.visits.daily.length) return 0;
    const sum = data.visits.daily.reduce((acc, d) => acc + d.count, 0);
    return Math.round(sum / data.visits.daily.length);
  }, [data]);

  const conversionRate = useMemo(() => {
    if (!data || !data.visits.total) return "0";
    const rate = (totalInteractions / data.visits.total) * 100;
    return rate.toFixed(1);
  }, [data, totalInteractions]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Cargando...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Inicia sesion.</div>;
  if (!isAdmin) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Acceso restringido.</div>;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="flex">
        {/* ── Sidebar ── */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-white/[0.06] bg-[#0d0e1a] min-h-screen sticky top-0">
          <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/[0.06]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-600 to-violet-600">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">Uzeed Admin</span>
          </div>
          <nav className="flex-1 py-3 px-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/admin/estadisticas";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all ${
                    isActive
                      ? "bg-fuchsia-500/10 text-fuchsia-300 font-medium"
                      : "text-white/45 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors lg:hidden">
                <ArrowLeft className="h-4 w-4 text-white/50" />
              </Link>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <BarChart3 className="h-4.5 w-4.5 text-fuchsia-400/60" />
                  Estadisticas
                </h1>
                <p className="text-[11px] text-white/30">Metricas y rendimiento de Uzeed</p>
              </div>
            </div>

            {/* Period selector */}
            <div className="flex gap-1 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
              {(["24h", "7d", "30d"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    period === p
                      ? "bg-fuchsia-600 text-white shadow-sm"
                      : "text-white/50 hover:text-white/70 hover:bg-white/[0.04]"
                  }`}
                >
                  {p === "24h" ? "24h" : p === "7d" ? "7d" : "30d"}
                </button>
              ))}
            </div>
          </header>

          <div className="px-4 sm:px-6 py-5 space-y-6">
            {/* Mobile nav */}
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden scrollbar-thin">
              {NAV_ITEMS.filter((n) => n.href !== "/admin/estadisticas").map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] text-white/50 hover:bg-white/[0.05] hover:text-white/70 transition-all"
                >
                  <item.icon className="h-3 w-3" />
                  {item.label}
                </Link>
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                <Activity className="h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-200/80">Error cargando estadisticas. Verifica que las tablas de analytics existan.</p>
              </div>
            )}

            {loadingData && !data && (
              <div className="space-y-6">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="h-3 w-8 rounded bg-white/[0.06] mb-3" />
                      <div className="h-6 w-16 rounded bg-white/[0.06] mb-1" />
                      <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 h-64" />
                  ))}
                </div>
              </div>
            )}

            {data && (
              <>
                {/* ── Top KPI Strip ── */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                  <KPICard
                    icon={Eye}
                    label="Visitas"
                    value={data.visits.total}
                    sub={`Hoy: ${data.visits.today}`}
                    accent="fuchsia"
                  />
                  <KPICard
                    icon={User}
                    label="Visitantes unicos"
                    value={data.visits.uniqueVisitors}
                    accent="violet"
                  />
                  <KPICard
                    icon={Users}
                    label="Usuarios"
                    value={data.users.total}
                    sub={`${data.users.professionals} profesionales`}
                    accent="blue"
                  />
                  <KPICard
                    icon={Zap}
                    label="Activos hoy"
                    value={data.users.activeToday}
                    sub={`+${data.users.newToday} nuevos`}
                    accent="emerald"
                  />
                  <KPICard
                    icon={MousePointerClick}
                    label="Interacciones"
                    value={totalInteractions}
                    sub={`${conversionRate}% conversion`}
                    accent="amber"
                  />
                  <KPICard
                    icon={TrendingUp}
                    label="Promedio diario"
                    value={avgDailyVisits}
                    sub="visitas/dia"
                    accent="cyan"
                  />
                </div>

                {/* ── Interaction Breakdown ── */}
                <div>
                  <SectionHeader icon={Activity} label="Interacciones" />
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                    <MiniCard icon={MessageSquare} label="Mensajes" value={data.interactions.messages} color="blue" />
                    <MiniCard icon={Video} label="Videollamadas" value={data.interactions.videocallBookings} color="fuchsia" />
                    <MiniCard icon={Users} label="Encuentros" value={data.interactions.serviceRequests} color="violet" />
                    <MiniCard icon={Heart} label="Favoritos" value={data.interactions.favorites} color="pink" />
                    <MiniCard icon={Phone} label="WhatsApp" value={data.interactions.whatsappClicks} color="emerald" />
                  </div>
                </div>

                {/* ── Charts Row ── */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Visitas diarias" data={data.visits.daily} color="fuchsia" />
                  <ChartCard title="Nuevos usuarios" data={data.users.dailyNew} color="blue" />
                </div>

                {/* ── Profile Health ── */}
                <div>
                  <SectionHeader icon={Shield} label="Salud de perfiles" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <HealthCard
                      label="Sin fotos"
                      value={data.users.profilesWithoutPhotos}
                      total={data.users.professionals}
                      color="amber"
                      desc="Perfiles profesionales sin foto de perfil"
                    />
                    <HealthCard
                      label="Inactivos 48h+"
                      value={data.users.inactiveProfiles}
                      total={data.users.professionals}
                      color="red"
                      desc="No han iniciado sesion en 48 horas"
                    />
                  </div>
                </div>

                {/* ── Rankings Row ── */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Top Pages */}
                  <RankingCard
                    title="Paginas mas visitadas"
                    icon={Globe}
                    items={data.visits.topPages.map((p) => ({
                      label: p.path,
                      value: p.count,
                    }))}
                    color="fuchsia"
                    emptyText="Sin datos de paginas"
                  />

                  {/* Top Actions */}
                  <RankingCard
                    title="Acciones mas usadas"
                    icon={MousePointerClick}
                    items={data.actions.top.map((a) => ({
                      label: ACTION_LABELS[a.action] || a.action,
                      value: a.count,
                      icon: ACTION_ICONS[a.action],
                    }))}
                    color="violet"
                    emptyText="Sin datos de acciones"
                  />
                </div>

                {/* ── WhatsApp + Locations ── */}
                <div className="grid gap-4 lg:grid-cols-3">
                  {/* WhatsApp */}
                  <RankingCard
                    title="Top WhatsApp"
                    icon={Phone}
                    items={data.whatsapp.topProfiles.map((p) => ({
                      label: p.displayName,
                      value: p.count,
                    }))}
                    color="emerald"
                    emptyText="Sin datos de WhatsApp"
                  />

                  {/* Cities */}
                  <RankingCard
                    title="Ciudades"
                    icon={MapPin}
                    items={data.locations.cities.map((c) => ({
                      label: c.city || "Desconocida",
                      value: c.count,
                    }))}
                    color="blue"
                    emptyText="Sin datos de ubicacion"
                  />

                  {/* Countries */}
                  <RankingCard
                    title="Paises"
                    icon={Globe}
                    items={data.locations.countries.map((c) => ({
                      label: c.country || "Desconocido",
                      value: c.count,
                    }))}
                    color="amber"
                    emptyText="Sin datos de ubicacion"
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-3.5 w-3.5 text-white/25" />
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/30">{label}</h2>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub, accent }: {
  icon: any; label: string; value: number; sub?: string; accent: string;
}) {
  const colors: Record<string, { bg: string; icon: string }> = {
    fuchsia: { bg: "border-fuchsia-500/15 bg-fuchsia-500/[0.06]", icon: "text-fuchsia-400/60" },
    violet: { bg: "border-violet-500/15 bg-violet-500/[0.06]", icon: "text-violet-400/60" },
    blue: { bg: "border-blue-500/15 bg-blue-500/[0.06]", icon: "text-blue-400/60" },
    emerald: { bg: "border-emerald-500/15 bg-emerald-500/[0.06]", icon: "text-emerald-400/60" },
    amber: { bg: "border-amber-500/15 bg-amber-500/[0.06]", icon: "text-amber-400/60" },
    cyan: { bg: "border-cyan-500/15 bg-cyan-500/[0.06]", icon: "text-cyan-400/60" },
    red: { bg: "border-red-500/15 bg-red-500/[0.06]", icon: "text-red-400/60" },
  };
  const c = colors[accent] || colors.fuchsia;

  return (
    <div className={`rounded-xl border ${c.bg} p-3 sm:p-4`}>
      <Icon className={`h-4 w-4 ${c.icon} mb-2`} />
      <p className="text-xl sm:text-2xl font-bold tabular-nums">{value.toLocaleString("es-CL")}</p>
      <p className="text-[11px] text-white/40 mt-0.5 truncate">{label}</p>
      {sub && <p className="text-[10px] text-white/25 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function MiniCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: number; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400/60",
    fuchsia: "text-fuchsia-400/60",
    violet: "text-violet-400/60",
    pink: "text-pink-400/60",
    emerald: "text-emerald-400/60",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.04] transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
        <Icon className={`h-3.5 w-3.5 ${colorMap[color] || "text-white/30"}`} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold tabular-nums leading-tight">{value.toLocaleString("es-CL")}</p>
        <p className="text-[10px] text-white/35 truncate">{label}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, data, color }: {
  title: string;
  data: { day: string; count: number }[];
  color: "fuchsia" | "blue" | string;
}) {
  const max = Math.max(...(data.map((d) => d.count)), 1);
  const total = data.reduce((acc, d) => acc + d.count, 0);
  const colorVal = color === "fuchsia" ? "#a855f7" : color === "blue" ? "#3b82f6" : "#a855f7";
  const colorBg = color === "fuchsia" ? "bg-fuchsia-500" : "bg-blue-500";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-white/30 tabular-nums">{total.toLocaleString("es-CL")} total</span>
      </div>
      <div className="p-4">
        {data.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-xs text-white/25">Sin datos</div>
        ) : (
          <div className="space-y-3">
            {/* SVG Line Chart */}
            <div className="relative h-32">
              <svg viewBox={`0 0 ${data.length * 40} 120`} className="w-full h-full" preserveAspectRatio="none">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                  <line
                    key={pct}
                    x1="0"
                    y1={8 + (1 - pct) * 104}
                    x2={data.length * 40}
                    y2={8 + (1 - pct) * 104}
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth="1"
                  />
                ))}

                {/* Area fill */}
                <defs>
                  <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colorVal} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={colorVal} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`M ${data.map((d, i) => `${i * 40 + 20},${8 + (1 - d.count / max) * 104}`).join(" L ")} L ${(data.length - 1) * 40 + 20},112 L 20,112 Z`}
                  fill={`url(#grad-${color})`}
                />

                {/* Line */}
                <polyline
                  points={data.map((d, i) => `${i * 40 + 20},${8 + (1 - d.count / max) * 104}`).join(" ")}
                  fill="none"
                  stroke={colorVal}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Dots */}
                {data.map((d, i) => (
                  <circle
                    key={i}
                    cx={i * 40 + 20}
                    cy={8 + (1 - d.count / max) * 104}
                    r="3"
                    fill={colorVal}
                    stroke="#0a0b14"
                    strokeWidth="2"
                  />
                ))}
              </svg>
            </div>

            {/* Bar chart below */}
            <div className="flex items-end gap-[3px]" style={{ height: 48 }}>
              {data.map((d) => {
                const h = Math.max((d.count / max) * 100, 4);
                const dayLabel = new Date(d.day + "T12:00:00").toLocaleDateString("es-CL", { day: "2-digit", month: "short" });
                return (
                  <div key={d.day} className="group relative flex flex-1 flex-col items-center gap-0.5">
                    <div
                      className={`w-full rounded-t ${colorBg} opacity-40 group-hover:opacity-70 transition-opacity`}
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[7px] text-white/25 truncate w-full text-center">{dayLabel}</span>
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="rounded bg-white/10 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-medium text-white whitespace-nowrap tabular-nums">
                        {d.count}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function HealthCard({ label, value, total, color, desc }: {
  label: string; value: number; total: number; color: string; desc: string;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const isWarning = pct > 30;
  const colorMap: Record<string, { bar: string; text: string; bg: string }> = {
    amber: { bar: "bg-amber-500", text: "text-amber-300", bg: "border-amber-500/15 bg-amber-500/[0.06]" },
    red: { bar: "bg-red-500", text: "text-red-300", bg: "border-red-500/15 bg-red-500/[0.06]" },
  };
  const c = colorMap[color] || colorMap.amber;

  return (
    <div className={`rounded-xl border ${c.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-white/40">{label}</span>
        {isWarning && <TrendingDown className={`h-3.5 w-3.5 ${c.text}`} />}
      </div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-white/30">/ {total} profesionales</span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden mb-2">
        <div
          className={`h-full rounded-full ${c.bar} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%`, opacity: 0.7 }}
        />
      </div>
      <p className="text-[10px] text-white/25">{desc} ({pct}%)</p>
    </div>
  );
}

function RankingCard({ title, icon: Icon, items, color, emptyText }: {
  title: string;
  icon: any;
  items: { label: string; value: number; icon?: any }[];
  color: string;
  emptyText: string;
}) {
  const colorMap: Record<string, { bar: string; accent: string }> = {
    fuchsia: { bar: "bg-fuchsia-500/15", accent: "text-fuchsia-400/60" },
    violet: { bar: "bg-violet-500/15", accent: "text-violet-400/60" },
    emerald: { bar: "bg-emerald-500/15", accent: "text-emerald-400/60" },
    blue: { bar: "bg-blue-500/15", accent: "text-blue-400/60" },
    amber: { bar: "bg-amber-500/15", accent: "text-amber-400/60" },
  };
  const c = colorMap[color] || colorMap.fuchsia;
  const max = items[0]?.value || 1;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-3">
        <Icon className={`h-3.5 w-3.5 ${c.accent}`} />
        <h3 className="text-sm font-semibold">{title}</h3>
        {items.length > 0 && (
          <span className="ml-auto text-[10px] text-white/25">{items.length} items</span>
        )}
      </div>
      <div className="p-2">
        {items.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-white/25">{emptyText}</div>
        ) : (
          <div className="space-y-0.5">
            {items.slice(0, 8).map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <div key={`${item.label}-${i}`} className="group relative rounded-lg overflow-hidden hover:bg-white/[0.02] transition-colors">
                  <div
                    className={`absolute inset-0 ${c.bar} transition-all`}
                    style={{ width: `${Math.max((item.value / max) * 100, 3)}%` }}
                  />
                  <div className="relative flex items-center gap-2 px-3 py-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white/25 bg-white/[0.04]">
                      {i + 1}
                    </span>
                    {ItemIcon && <ItemIcon className="h-3 w-3 shrink-0 text-white/25" />}
                    <span className="text-[12px] text-white/70 truncate flex-1">{item.label}</span>
                    <span className="text-[12px] font-semibold text-white/50 tabular-nums">{item.value.toLocaleString("es-CL")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
