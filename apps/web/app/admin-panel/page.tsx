"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type Tab =
  | "pendientes"
  | "perfiles"
  | "ads"
  | "metricas"
  | "reviews"
  | "settings";

export default function AdminPanelPage() {
  const [tab, setTab] = useState<Tab>("pendientes");
  const [pending, setPending] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    apiFetch<{ items: any[] }>("/admin/profiles?status=PENDING_REVIEW")
      .then((r) => setPending(r.items || []))
      .catch(() => setPending([]));
    apiFetch("/admin/metrics")
      .then(setMetrics)
      .catch(() => setMetrics(null));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <h1 className="text-2xl font-semibold">Admin panel</h1>
      <div className="flex flex-wrap gap-2">
        {(
          [
            "pendientes",
            "perfiles",
            "ads",
            "metricas",
            "reviews",
            "settings",
          ] as Tab[]
        ).map((t) => (
          <button
            key={t}
            className={`rounded-xl border px-3 py-2 text-sm ${tab === t ? "border-fuchsia-300" : "border-white/20"}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "pendientes" ? (
        <div className="grid gap-2">
          {pending.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 p-3"
            >
              <p className="font-medium">{item.displayName || item.username}</p>
              <p className="text-xs text-white/60">
                {item.profileType} · {item.moderationStatus}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  className="rounded-lg border border-emerald-400/40 px-2 py-1 text-xs"
                  onClick={() =>
                    apiFetch(`/admin/profiles/${item.id}/moderation`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: "APPROVED" }),
                    }).then(() => window.location.reload())
                  }
                >
                  Aprobar
                </button>
                <button
                  className="rounded-lg border border-red-400/40 px-2 py-1 text-xs"
                  onClick={() =>
                    apiFetch(`/admin/profiles/${item.id}/moderation`, {
                      method: "PATCH",
                      body: JSON.stringify({ status: "REJECTED" }),
                    }).then(() => window.location.reload())
                  }
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === "metricas" ? (
        <div className="grid gap-2 rounded-xl border border-white/10 p-4 text-sm">
          <p>Total usuarios: {metrics?.users ?? 0}</p>
          <p>Perfiles aprobados: {metrics?.approvedProfiles ?? 0}</p>
          <p>Perfiles pendientes: {metrics?.pendingProfiles ?? 0}</p>
          <p>Mensajes: {metrics?.messages ?? 0}</p>
          <p>Vistas stories: {metrics?.storyViews ?? 0}</p>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="rounded-xl border border-white/10 p-4 text-sm text-white/70">
          Configura términos en /admin/terms y links de app vía ENV:
          NEXT_PUBLIC_ANDROID_APP_URL / NEXT_PUBLIC_IOS_APP_URL.
        </div>
      ) : null}
    </div>
  );
}
