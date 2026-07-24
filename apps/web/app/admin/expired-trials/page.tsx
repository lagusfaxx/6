"use client";

import { useEffect, useMemo, useState } from "react";
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
  CircleDollarSign,
  Clock,
  Eye,
  Heart,
  LayoutGrid,
  MessageSquare,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  Store,
  Tag,
  Trash2,
  TrendingDown,
  UserCheck,
  Users,
} from "lucide-react";

type ExpiredTrialItem = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  profileType: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  trialEndedAt: string;
  daysExpired: number;
  lastSeen: string | null;
  profileViews: number;
  messagesReceived: number;
  favoritesReceived: number;
  whatsappClicks: number;
  potentialMonthlyClp: number;
  estimatedLostClp: number;
};

type ExpiredTrialsResponse = {
  generatedAt: string;
  monthlyPriceClp: number;
  summary: {
    total: number;
    listed: number;
    potentialMonthlyClp: number;
    estimatedLostClpListed: number;
  };
  items: ExpiredTrialItem[];
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/estadisticas", label: "Estadisticas", icon: BarChart3 },
  { href: "/admin/expired-trials", label: "Pruebas caducadas", icon: Clock },
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

const PROFILE_TYPE_LABELS: Record<string, string> = {
  PROFESSIONAL: "Profesional",
  ESTABLISHMENT: "Establecimiento",
  SHOP: "Tienda",
};

function formatClp(value: number): string {
  return `$${value.toLocaleString("es-CL")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric" });
}

function lastSeenLabel(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days < 1) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days}d`;
  return `Hace ${Math.floor(days / 30)}m`;
}

export default function AdminExpiredTrials() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";
  const [data, setData] = useState<ExpiredTrialsResponse | null>(null);
  const [error, setError] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    setError(false);
    setLoadingData(true);
    const qs = query ? `?q=${encodeURIComponent(query)}` : "";
    apiFetch<ExpiredTrialsResponse>(`/admin/expired-trials${qs}`)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoadingData(false));
  }, [isAdmin, query]);

  const avgEngagement = useMemo(() => {
    if (!data || !data.items.length) return 0;
    const total = data.items.reduce(
      (acc, i) => acc + i.messagesReceived + i.favoritesReceived + i.whatsappClicks,
      0,
    );
    return Math.round(total / data.items.length);
  }, [data]);

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
              const isActive = item.href === "/admin/expired-trials";
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
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
            <div className="flex items-center gap-3">
              <Link href="/admin" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors lg:hidden">
                <ArrowLeft className="h-4 w-4 text-white/50" />
              </Link>
              <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <Clock className="h-4.5 w-4.5 text-amber-400/60" />
                  Pruebas gratuitas caducadas
                </h1>
                <p className="text-[11px] text-white/30">Perfiles sin membresia activa y su ganancia potencial</p>
              </div>
            </div>

            {/* Search */}
            <form
              className="relative hidden sm:block"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, usuario o email..."
                className="w-64 rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/25 outline-none focus:border-fuchsia-500/40"
              />
            </form>
          </header>

          <div className="px-4 sm:px-6 py-5 space-y-6">
            {/* Mobile search */}
            <form
              className="relative sm:hidden"
              onSubmit={(e) => {
                e.preventDefault();
                setQuery(search.trim());
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/25" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar nombre, usuario o email..."
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/25 outline-none focus:border-fuchsia-500/40"
              />
            </form>

            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3">
                <Activity className="h-4 w-4 shrink-0 text-red-400" />
                <p className="text-sm text-red-200/80">Error cargando los perfiles con prueba caducada.</p>
              </div>
            )}

            {loadingData && !data && (
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="h-3 w-8 rounded bg-white/[0.06] mb-3" />
                    <div className="h-6 w-16 rounded bg-white/[0.06] mb-1" />
                    <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            )}

            {data && (
              <>
                {/* ── KPI Strip ── */}
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-4">
                    <Clock className="h-4 w-4 text-amber-400/60 mb-2" />
                    <p className="text-xl sm:text-2xl font-bold tabular-nums">{data.summary.total.toLocaleString("es-CL")}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Perfiles con prueba caducada</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                    <CircleDollarSign className="h-4 w-4 text-emerald-400/60 mb-2" />
                    <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatClp(data.summary.potentialMonthlyClp)}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Ganancia potencial / mes</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{formatClp(data.monthlyPriceClp)} por perfil</p>
                  </div>
                  <div className="rounded-xl border border-red-500/15 bg-red-500/[0.06] p-4">
                    <TrendingDown className="h-4 w-4 text-red-400/60 mb-2" />
                    <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatClp(data.summary.estimatedLostClpListed)}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Perdida estimada acumulada</p>
                    <p className="text-[10px] text-white/25 mt-0.5">Sobre {data.summary.listed} perfiles listados</p>
                  </div>
                  <div className="rounded-xl border border-blue-500/15 bg-blue-500/[0.06] p-4">
                    <Activity className="h-4 w-4 text-blue-400/60 mb-2" />
                    <p className="text-xl sm:text-2xl font-bold tabular-nums">{avgEngagement.toLocaleString("es-CL")}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Interes promedio por perfil</p>
                    <p className="text-[10px] text-white/25 mt-0.5">Mensajes + favoritos + WhatsApp</p>
                  </div>
                </div>

                {/* ── Table ── */}
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
                    <h3 className="text-sm font-semibold">Perfiles ({data.summary.listed} de {data.summary.total})</h3>
                    <span className="text-[10px] text-white/25">Ordenados por caducidad reciente</span>
                  </div>
                  {data.items.length === 0 ? (
                    <div className="px-4 py-10 text-center text-xs text-white/25">No hay perfiles con prueba caducada.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-[12px]">
                        <thead>
                          <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-white/30">
                            <th className="px-4 py-2.5 font-medium">Perfil</th>
                            <th className="px-3 py-2.5 font-medium">Tipo</th>
                            <th className="px-3 py-2.5 font-medium">Caducidad</th>
                            <th className="px-3 py-2.5 font-medium">Ultima conexion</th>
                            <th className="px-3 py-2.5 font-medium text-right">
                              <Eye className="inline h-3 w-3" /> Vistas
                            </th>
                            <th className="px-3 py-2.5 font-medium text-right">
                              <MessageSquare className="inline h-3 w-3" /> Msjs
                            </th>
                            <th className="px-3 py-2.5 font-medium text-right">
                              <Heart className="inline h-3 w-3" /> Favs
                            </th>
                            <th className="px-3 py-2.5 font-medium text-right">
                              <Phone className="inline h-3 w-3" /> WA
                            </th>
                            <th className="px-3 py-2.5 font-medium text-right">Potencial/mes</th>
                            <th className="px-4 py-2.5 font-medium text-right">Perdida est.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.items.map((p) => (
                            <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                              <td className="px-4 py-2.5">
                                <Link href={`/profesional/${p.id}`} className="flex items-center gap-2.5 group">
                                  {p.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                                  ) : (
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[11px] font-bold text-white/40">
                                      {(p.displayName || p.username).charAt(0).toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-white/80 group-hover:text-fuchsia-300 transition-colors">
                                      {p.displayName || p.username}
                                    </p>
                                    <p className="truncate text-[10px] text-white/30">
                                      @{p.username}{p.city ? ` · ${p.city}` : ""}
                                    </p>
                                  </div>
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 text-white/50">{PROFILE_TYPE_LABELS[p.profileType] || p.profileType}</td>
                              <td className="px-3 py-2.5">
                                <p className="text-white/60">{formatDate(p.trialEndedAt)}</p>
                                <p className="text-[10px] text-amber-400/60">Hace {p.daysExpired}d</p>
                              </td>
                              <td className="px-3 py-2.5 text-white/50">{lastSeenLabel(p.lastSeen)}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{p.profileViews.toLocaleString("es-CL")}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{p.messagesReceived.toLocaleString("es-CL")}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{p.favoritesReceived.toLocaleString("es-CL")}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-white/60">{p.whatsappClicks.toLocaleString("es-CL")}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-emerald-300/80">{formatClp(p.potentialMonthlyClp)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-red-300/70">{formatClp(p.estimatedLostClp)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
