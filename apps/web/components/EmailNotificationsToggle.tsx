"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { apiFetch } from "../lib/api";

/**
 * Interruptor del aviso por correo de mensajes sin leer.
 *
 * El estado se pide al servidor en vez de asumir el valor por defecto: si la
 * persona se dio de baja desde el enlace de un correo, aquí tiene que verse
 * apagado.
 */
export default function EmailNotificationsToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<{ emailOnNewMessage: boolean }>("/notifications/email/preferences")
      .then((r) => { if (alive) setEnabled(Boolean(r?.emailOnNewMessage)); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, []);

  const toggle = useCallback(async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError(false);
    // Optimista: el interruptor responde al toque y se revierte si falla.
    setEnabled(next);
    try {
      const r = await apiFetch<{ emailOnNewMessage: boolean }>(
        "/notifications/email/preferences",
        { method: "PATCH", body: JSON.stringify({ emailOnNewMessage: next }) },
      );
      setEnabled(Boolean(r?.emailOnNewMessage));
    } catch {
      setEnabled(!next);
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [enabled, saving]);

  if (enabled === null && !error) {
    return <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <Mail className="h-4 w-4 shrink-0 text-white/30" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Avisarme por correo</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">
            Cuando tengas mensajes sin leer. Como máximo uno cada 30 minutos.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(enabled)}
          aria-label="Avisarme por correo de mensajes sin leer"
          onClick={toggle}
          disabled={saving || enabled === null}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-fuchsia-600" : "bg-white/15"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              enabled ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {error && (
        <p className="mt-2 text-[11px] text-red-300">
          No se pudo guardar la preferencia. Inténtalo de nuevo.
        </p>
      )}
    </div>
  );
}
