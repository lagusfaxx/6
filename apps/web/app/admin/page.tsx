"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useMe from "../../hooks/useMe";
import { apiFetch } from "../../lib/api";
import { connectRealtime } from "../../lib/realtime";

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
  deposit_submitted: {
    title: "Nuevo depósito pendiente",
    url: "/admin/deposits",
  },
  withdrawal_requested: {
    title: "Solicitud de retiro recibida",
    url: "/admin/withdrawals",
  },
  profile_verification_requested: {
    title: "Perfil solicitó verificación",
    url: "/admin/verifications",
  },
  content_reported: { title: "Contenido reportado", url: "/admin/moderation" },
};

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
        setMetrics((prev) => ({
          ...prev,
          pendingDeposits: prev.pendingDeposits + 1,
        }));
      } else if (payload.type === "withdrawal_requested") {
        setMetrics((prev) => ({
          ...prev,
          pendingWithdrawals: prev.pendingWithdrawals + 1,
        }));
      } else if (payload.type === "profile_verification_requested") {
        setMetrics((prev) => ({
          ...prev,
          pendingVerifications: prev.pendingVerifications + 1,
        }));
      } else if (payload.type === "content_reported") {
        setMetrics((prev) => ({
          ...prev,
          pendingReports: prev.pendingReports + 1,
        }));
      }

      const fallback = notificationFallback[payload.type] || {
        title: "Notificación",
        url: "/admin",
      };
      const freshNotification: AdminNotification = {
        id: `rt-${payload.type}-${payload.timestamp || Date.now()}`,
        type: payload.type || "admin_event",
        title: payload.title || fallback.title,
        body: payload.body || "Nuevo evento crítico",
        url: payload.url || fallback.url,
        timestamp: new Date(payload.timestamp || Date.now()).toISOString(),
        readAt: null,
        user: payload.user || null,
        amount: payload.amount || null,
      };

      setNotifications((prev) => [freshNotification, ...prev].slice(0, 20));
      setActivity((prev) =>
        [
          {
            type: payload.type || "admin_event",
            label: payload.title || fallback.title,
            user: payload.user || null,
            timestamp: freshNotification.timestamp,
          },
          ...prev,
        ].slice(0, 10),
      );

      const isStandalone =
        typeof window !== "undefined" &&
        window.matchMedia?.("(display-mode: standalone)")?.matches;
      if (
        isStandalone &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(freshNotification.title, {
            body: freshNotification.body,
            tag: `admin-${freshNotification.type}`,
          });
        } catch {}
      }
    });

    return () => {
      mounted = false;
      disconnect();
    };
  }, [isAdmin]);

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user)
    return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin)
    return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Centro de Control Admin</h1>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          🔔 Notificaciones{" "}
          <span className="ml-2 rounded-full bg-fuchsia-500/30 px-2 py-0.5 text-fuchsia-100">
            {unreadCount}
          </span>
        </div>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-white/60">
          System Status
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Usuarios activos hoy"
            value={metrics.activeUsersToday}
          />
          <StatCard
            label="Verificaciones pendientes"
            value={metrics.pendingVerifications}
          />
          <StatCard
            label="Depósitos pendientes"
            value={metrics.pendingDeposits}
          />
          <StatCard
            label="Retiros pendientes"
            value={metrics.pendingWithdrawals}
          />
          <StatCard
            label="Reportes pendientes"
            value={metrics.pendingReports}
          />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-[0.18em] text-white/60">
          Admin Actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionCard
            href="/admin/verification"
            title="Verificación de Perfiles"
            subtitle={`${metrics.pendingVerifications} pendientes`}
            tone="amber"
          />
          <ActionCard
            href="/admin/profiles"
            title="Perfiles"
            subtitle="Gestión general"
          />
          <ActionCard
            href="/admin/banners"
            title="Banners"
            subtitle="Campañas activas"
          />
          <ActionCard
            href="/admin/pricing"
            title="Precios"
            subtitle="Planes y reglas"
          />
          <ActionCard
            href="/admin/deposits"
            title="Depósitos de Tokens"
            subtitle={`${metrics.pendingDeposits} pendientes`}
            tone="fuchsia"
          />
          <ActionCard
            href="/admin/withdrawals"
            title="Solicitudes de Retiro"
            subtitle={`${metrics.pendingWithdrawals} pendientes`}
            tone="emerald"
          />
        </div>
      </section>

      <section className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold">Actividad reciente</h3>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            {activity.length === 0 ? (
              <li className="text-white/50">Sin actividad reciente.</li>
            ) : (
              activity.map((item, idx) => (
                <li
                  key={`${item.type}-${idx}`}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                >
                  <div className="font-medium text-white/90">{item.label}</div>
                  <div className="text-xs text-white/60">
                    {item.user ? `@${item.user} · ` : ""}
                    {new Date(item.timestamp).toLocaleString("es-CL")}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-semibold">🔔 Notifications</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {notifications.length === 0 ? (
              <li className="text-white/50">No hay notificaciones críticas.</li>
            ) : (
              notifications.slice(0, 10).map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.url}
                    className="block rounded-xl border border-white/10 bg-black/20 px-3 py-2 hover:bg-black/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-white/90">
                        {item.title}
                      </span>
                      {!item.readAt ? (
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-fuchsia-400" />
                      ) : null}
                    </div>
                    <div className="text-xs text-white/65">{item.body}</div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-white/65">{label}</div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  subtitle,
  tone = "default",
}: {
  href: string;
  title: string;
  subtitle: string;
  tone?: "default" | "amber" | "fuchsia" | "emerald";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10"
      : tone === "fuchsia"
        ? "border-fuchsia-500/20 bg-fuchsia-500/5 hover:bg-fuchsia-500/10"
        : tone === "emerald"
          ? "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10"
          : "border-white/10 bg-white/5 hover:bg-white/10";

  return (
    <Link
      href={href}
      className={`rounded-2xl border p-4 transition ${toneClass}`}
    >
      <div className="text-lg font-semibold">{title}</div>
      <div className="text-sm text-white/70">{subtitle}</div>
    </Link>
  );
}
