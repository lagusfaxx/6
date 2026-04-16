"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";
import { connectRealtime } from "../../lib/realtime";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BadgeCheck,
  BarChart3,
  Bell,
  BookImage,
  CircleDollarSign,
  Clock,
  CreditCard,
  LayoutGrid,
  ListChecks,
  MapPin,
  Shield,
  ShieldCheck,
  Store,
  Tag,
  Trash2,
  TrendingUp,
  User,
  UserCheck,
  Users,
  Star,
  Mail,
} from "lucide-react";

type MetricBundle = {
  activeUsersToday: number;
  pendingVerifications: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  pendingReports: number;
};

type ActivityItem = {
  type: string;
  label: string;
  user?: string | null;
  timestamp: string;
};

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  timestamp: string;
  readAt: string | null;
  user?: string | null;
  amount?: number | null;
};

const emptyMetrics: MetricBundle = {
  activeUsersToday: 0,
  pendingVerifications: 0,
  pendingDeposits: 0,
  pendingWithdrawals: 0,
  pendingReports: 0,
};

const notificationFallback: Record<string, { title: string; url: string }> = {
  deposit_submitted: { title: "Nuevo deposito pendiente", url: "/admin/deposits" },
  withdrawal_requested: { title: "Solicitud de retiro recibida", url: "/admin/withdrawals" },
  profile_verification_requested: { title: "Perfil solicito verificacion", url: "/admin/verifications" },
  content_reported: { title: "Contenido reportado", url: "/admin/moderation" },
  deletion_requested: { title: "Solicitud de eliminacion", url: "/admin/privacy-requests" },
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid },
  { href: "/admin/estadisticas", label: "Estadisticas", icon: BarChart3 },
  { href: "/admin/verification", label: "Verificaciones", icon: UserCheck },
  { href: "/admin/profiles", label: "Perfiles", icon: Users },
  { href: "/admin/rating", label: "Catador", icon: Star },
  { href: "/admin/deposits", label: "Depositos", icon: ArrowDownToLine },
  { href: "/admin/withdrawals", label: "Retiros", icon: ArrowUpFromLine },
  { href: "/admin/banners", label: "Banners", icon: BookImage },
  { href: "/admin/pricing", label: "Precios", icon: Tag },
  { href: "/admin/quick-listings", label: "Listados", icon: Store },
  { href: "/admin/quick-professionals", label: "Profesionales", icon: UserCheck },
  { href: "/admin/acreditaciones", label: "Acreditaciones", icon: ShieldCheck },
  { href: "/admin/moderation", label: "Moderacion", icon: Shield },
  { href: "/admin/privacy-requests", label: "Privacidad", icon: Trash2 },
  { href: "/admin/weekly-highlights", label: "Correo Semanal", icon: Mail },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function AdminIndex() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = (user?.role ?? "").toUpperCase() === "ADMIN";

  const [metrics, setMetrics] = useState<MetricBundle>(emptyMetrics);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.readAt).length,
    [notifications],
  );

  useEffect(() => {
    if (!isAdmin) return;
    let mounted = true;

    const load = async () => {
      try {
        const res = await apiFetch<{
          metrics: MetricBundle;
          recentActivity: ActivityItem[];
          notifications: AdminNotification[];
        }>("/admin/control-center");
        if (!mounted) return;
        setMetrics(res.metrics || emptyMetrics);
        setActivity((res.recentActivity || []).slice(0, 10));
        setNotifications(res.notifications || []);
      } catch {
        if (!mounted) return;
      }
    };

    load();
    const disconnect = connectRealtime((event) => {
      if (event.type !== "admin_event" || !event.data) return;
      const payload = event.data as any;

      if (payload.type === "deposit_submitted") {
        setMetrics((prev) => ({ ...prev, pendingDeposits: prev.pendingDeposits + 1 }));
      } else if (payload.type === "withdrawal_requested") {
        setMetrics((prev) => ({ ...prev, pendingWithdrawals: prev.pendingWithdrawals + 1 }));
      } else if (payload.type === "profile_verification_requested") {
        setMetrics((prev) => ({ ...prev, pendingVerifications: prev.pendingVerifications + 1 }));
      } else if (payload.type === "content_reported") {
        setMetrics((prev) => ({ ...prev, pendingReports: prev.pendingReports + 1 }));
      }

      const fallback = notificationFallback[payload.type] || { title: "Notificacion", url: "/admin" };
      const freshNotification: AdminNotification = {
        id: `rt-${payload.type}-${payload.timestamp || Date.now()}`,
        type: payload.type || "admin_event",
        title: payload.title || fallback.title,
        body: payload.body || "Nuevo evento",
        url: payload.url || fallback.url,
        timestamp: new Date(payload.timestamp || Date.now()).toISOString(),
        readAt: null,
        user: payload.user || null,
        amount: payload.amount || null,
      };

      setNotifications((prev) => [freshNotification, ...prev].slice(0, 20));
      setActivity((prev) =>
        [{ type: payload.type || "admin_event", label: payload.title || fallback.title, user: payload.user || null, timestamp: freshNotification.timestamp }, ...prev].slice(0, 10),
      );

      const isStandalone = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)")?.matches;
      if (isStandalone && "Notification" in window && Notification.permission === "granted") {
        try { new Notification(freshNotification.title, { body: freshNotification.body, tag: `admin-${freshNotification.type}` }); } catch {}
      }
    });

    return () => { mounted = false; disconnect(); };
  }, [isAdmin]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Cargando...</div>;
  if (!user) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Inicia sesion.</div>;
  if (!isAdmin) return <div className="flex h-screen items-center justify-center bg-[#0a0b14] text-white/50">Acceso restringido.</div>;

  const totalPending = metrics.pendingVerifications + metrics.pendingDeposits + metrics.pendingWithdrawals;

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
              const isActive = item.href === "/admin";
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
                  {item.href === "/admin/verification" && metrics.pendingVerifications > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">{metrics.pendingVerifications}</span>
                  )}
                  {item.href === "/admin/deposits" && metrics.pendingDeposits > 0 && (
                    <span className="ml-auto rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">{metrics.pendingDeposits}</span>
                  )}
                  {item.href === "/admin/withdrawals" && metrics.pendingWithdrawals > 0 && (
                    <span className="ml-auto rounded-full bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">{metrics.pendingWithdrawals}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 min-w-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0b14]/90 backdrop-blur-xl px-4 sm:px-6 py-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight">Dashboard</h1>
              <p className="text-[11px] text-white/30">Centro de control de Uzeed</p>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-fuchsia-500/20 bg-fuchsia-500/10 px-2.5 py-1">
                  <Bell className="h-3 w-3 text-fuchsia-400" />
                  <span className="text-[11px] font-bold text-fuchsia-300">{unreadCount}</span>
                </div>
              )}
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500/20 to-violet-500/15 border border-white/10 text-[11px] font-bold text-fuchsia-300">
                {(user.displayName || user.username || "A")[0].toUpperCase()}
              </div>
            </div>
          </header>

          <div className="px-4 sm:px-6 py-5 space-y-6">
            {/* ── Mobile nav (horizontal scroll) ── */}
            <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden scrollbar-thin">
              {NAV_ITEMS.filter((n) => n.href !== "/admin").map((item) => (
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

            {/* ── Pending Actions Alert ── */}
            {totalPending > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-sm text-amber-200/80 flex-1">
                  <span className="font-semibold text-amber-300">{totalPending} acciones pendientes</span>
                  {" — "}
                  {metrics.pendingVerifications > 0 && `${metrics.pendingVerifications} verificaciones`}
                  {metrics.pendingVerifications > 0 && metrics.pendingDeposits > 0 && ", "}
                  {metrics.pendingDeposits > 0 && `${metrics.pendingDeposits} depositos`}
                  {(metrics.pendingVerifications > 0 || metrics.pendingDeposits > 0) && metrics.pendingWithdrawals > 0 && ", "}
                  {metrics.pendingWithdrawals > 0 && `${metrics.pendingWithdrawals} retiros`}
                </p>
              </div>
            )}

            {/* ── KPI Cards ── */}
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
              <KPICard icon={Users} label="Usuarios activos" value={metrics.activeUsersToday} accent="fuchsia" />
              <KPICard icon={UserCheck} label="Verificaciones" value={metrics.pendingVerifications} accent="amber" badge="pendiente" />
              <KPICard icon={ArrowDownToLine} label="Depositos" value={metrics.pendingDeposits} accent="emerald" badge="pendiente" />
              <KPICard icon={ArrowUpFromLine} label="Retiros" value={metrics.pendingWithdrawals} accent="blue" badge="pendiente" />
              <KPICard icon={AlertTriangle} label="Reportes" value={metrics.pendingReports} accent="red" badge="pendiente" />
            </div>

            {/* ── Quick Actions Grid ── */}
            <div>
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/30 mb-3">Acceso rapido</h2>
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                <QuickAction href="/admin/estadisticas" icon={BarChart3} label="Estadisticas" desc="Metricas y graficos" accent="fuchsia" />
                <QuickAction href="/admin/verification" icon={BadgeCheck} label="Verificaciones" desc={`${metrics.pendingVerifications} pendientes`} accent="amber" />
                <QuickAction href="/admin/profiles" icon={Users} label="Perfiles" desc="Gestion de usuarios" accent="violet" />
                <QuickAction href="/admin/rating" icon={Star} label="Catador" desc="Calificar perfiles" accent="amber" />
                <QuickAction href="/admin/deposits" icon={CircleDollarSign} label="Depositos" desc={`${metrics.pendingDeposits} pendientes`} accent="emerald" />
                <QuickAction href="/admin/withdrawals" icon={CreditCard} label="Retiros" desc={`${metrics.pendingWithdrawals} pendientes`} accent="blue" />
                <QuickAction href="/admin/banners" icon={BookImage} label="Banners" desc="Promociones" accent="pink" />
                <QuickAction href="/admin/pricing" icon={Tag} label="Precios" desc="Planes y reglas" accent="violet" />
                <QuickAction href="/admin/quick-listings" icon={Store} label="Listados" desc="Externos" accent="cyan" />
                <QuickAction href="/admin/weekly-highlights" icon={Mail} label="Correo Semanal" desc="Destacadas" accent="pink" />
              </div>
            </div>

            {/* ── Activity + Notifications ── */}
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Activity Timeline */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-3.5 w-3.5 text-fuchsia-400/60" />
                    <h3 className="text-sm font-semibold">Actividad reciente</h3>
                  </div>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {activity.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-white/25">Sin actividad reciente</div>
                  ) : (
                    activity.map((item, idx) => (
                      <div key={`${item.type}-${idx}`} className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                          <ActivityIcon type={item.type} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white/75 truncate">{item.label}</p>
                          <p className="text-[11px] text-white/30">
                            {item.user && <span className="text-fuchsia-400/60">@{item.user} </span>}
                            {timeAgo(item.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Notifications */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-3.5 w-3.5 text-amber-400/60" />
                    <h3 className="text-sm font-semibold">Notificaciones</h3>
                  </div>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300">{unreadCount} nuevas</span>
                  )}
                </div>
                <div className="divide-y divide-white/[0.04] max-h-[400px] overflow-y-auto scrollbar-thin">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-white/25">Sin notificaciones</div>
                  ) : (
                    notifications.slice(0, 12).map((item) => (
                      <Link
                        key={item.id}
                        href={item.url}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors"
                      >
                        <div className="mt-0.5 relative">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
                            <NotifIcon type={item.type} />
                          </div>
                          {!item.readAt && (
                            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-fuchsia-400 border border-[#0a0b14]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[13px] truncate ${!item.readAt ? "text-white/85 font-medium" : "text-white/55"}`}>
                            {item.title}
                          </p>
                          <p className="text-[11px] text-white/30 truncate">{item.body}</p>
                          <p className="text-[10px] text-white/20 mt-0.5">{timeAgo(item.timestamp)}</p>
                        </div>
                        <ArrowRight className="h-3 w-3 shrink-0 text-white/15 mt-1.5" />
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function KPICard({ icon: Icon, label, value, accent, badge }: {
  icon: any; label: string; value: number; accent: string; badge?: string;
}) {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    fuchsia: { bg: "bg-fuchsia-500/10 border-fuchsia-500/15", text: "text-fuchsia-300", icon: "text-fuchsia-400/60" },
    amber: { bg: "bg-amber-500/10 border-amber-500/15", text: "text-amber-300", icon: "text-amber-400/60" },
    emerald: { bg: "bg-emerald-500/10 border-emerald-500/15", text: "text-emerald-300", icon: "text-emerald-400/60" },
    blue: { bg: "bg-blue-500/10 border-blue-500/15", text: "text-blue-300", icon: "text-blue-400/60" },
    red: { bg: "bg-red-500/10 border-red-500/15", text: "text-red-300", icon: "text-red-400/60" },
  };
  const c = colors[accent] || colors.fuchsia;

  return (
    <div className={`rounded-xl border ${c.bg} p-3 sm:p-4`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`h-4 w-4 ${c.icon}`} />
        {badge && value > 0 && (
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${c.text} bg-white/[0.06]`}>{badge}</span>
        )}
      </div>
      <p className="text-xl sm:text-2xl font-bold">{value}</p>
      <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, desc, accent }: {
  href: string; icon: any; label: string; desc: string; accent: string;
}) {
  const accents: Record<string, string> = {
    fuchsia: "hover:border-fuchsia-500/20 group-hover:text-fuchsia-400",
    amber: "hover:border-amber-500/20 group-hover:text-amber-400",
    violet: "hover:border-violet-500/20 group-hover:text-violet-400",
    emerald: "hover:border-emerald-500/20 group-hover:text-emerald-400",
    blue: "hover:border-blue-500/20 group-hover:text-blue-400",
    pink: "hover:border-pink-500/20 group-hover:text-pink-400",
    cyan: "hover:border-cyan-500/20 group-hover:text-cyan-400",
  };

  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 transition-all hover:bg-white/[0.04] ${accents[accent] || ""}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] group-hover:bg-white/[0.06] transition-colors">
        <Icon className={`h-4 w-4 text-white/30 ${accents[accent] || ""}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-white/80 group-hover:text-white transition-colors">{label}</p>
        <p className="text-[10px] text-white/30">{desc}</p>
      </div>
    </Link>
  );
}

function ActivityIcon({ type }: { type: string }) {
  if (type === "deposit_submitted") return <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-400/60" />;
  if (type === "withdrawal_requested") return <ArrowUpFromLine className="h-3.5 w-3.5 text-blue-400/60" />;
  if (type === "profile_verification_requested") return <UserCheck className="h-3.5 w-3.5 text-amber-400/60" />;
  if (type === "content_reported") return <AlertTriangle className="h-3.5 w-3.5 text-red-400/60" />;
  return <Activity className="h-3.5 w-3.5 text-white/30" />;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "deposit_submitted") return <CircleDollarSign className="h-3.5 w-3.5 text-emerald-400/60" />;
  if (type === "withdrawal_requested") return <CreditCard className="h-3.5 w-3.5 text-blue-400/60" />;
  if (type === "profile_verification_requested") return <BadgeCheck className="h-3.5 w-3.5 text-amber-400/60" />;
  if (type === "content_reported") return <Shield className="h-3.5 w-3.5 text-red-400/60" />;
  if (type === "deletion_requested") return <Trash2 className="h-3.5 w-3.5 text-red-400/60" />;
  return <Bell className="h-3.5 w-3.5 text-white/30" />;
}
