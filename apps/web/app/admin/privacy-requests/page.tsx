"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  timestamp: string;
  readAt: string | null;
  user?: string | null;
};

export default function PrivacyRequestsPage() {
  const [items, setItems] = useState<AdminNotification[]>([]);

  useEffect(() => {
    apiFetch<{ notifications: AdminNotification[] }>("/admin/control-center")
      .then((res) =>
        setItems(
          (res.notifications || []).filter(
            (n) => n.type === "deletion_requested",
          ),
        ),
      )
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link
          href="/admin"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 transition hover:bg-white/10"
        >
          ← Admin
        </Link>
        <h1 className="text-2xl font-semibold">Solicitudes de Privacidad</h1>
      </div>
      <p className="mt-1 text-sm text-white/70">
        Solicitudes de eliminación de cuentas y datos de usuarios.
      </p>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Sin solicitudes pendientes.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border p-4 ${
                n.readAt
                  ? "border-white/10 bg-white/5"
                  : "border-amber-400/30 bg-amber-500/10"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 text-sm text-white/70">{n.body}</p>
                  {n.user && (
                    <p className="mt-1 text-xs text-fuchsia-300">
                      Contacto: {n.user}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-white/40">
                  {new Date(n.timestamp).toLocaleString("es-CL")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
