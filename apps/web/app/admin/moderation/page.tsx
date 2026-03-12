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
};

export default function ModerationPage() {
  const [items, setItems] = useState<AdminNotification[]>([]);

  useEffect(() => {
    apiFetch<{ notifications: AdminNotification[] }>("/admin/control-center")
      .then((res) =>
        setItems(
          (res.notifications || []).filter(
            (n) => n.type === "content_reported",
          ),
        ),
      )
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      <h1 className="text-2xl font-semibold">Moderación</h1>
      <p className="mt-1 text-sm text-white/70">
        Revisa alertas de contenido reportado.
      </p>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
            Sin reportes pendientes.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="font-medium">{item.title}</div>
              <div className="text-sm text-white/70">{item.body}</div>
              <div className="mt-2 text-xs text-white/50">
                {new Date(item.timestamp).toLocaleString("es-CL")}
              </div>
            </div>
          ))
        )}
      </div>
      <Link
        href="/admin"
        className="mt-5 inline-block text-sm text-fuchsia-300 hover:underline"
      >
        Volver al panel admin
      </Link>
    </div>
  );
}
