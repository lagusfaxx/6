"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageIcon } from "lucide-react";
import { apiFetch } from "../lib/api";

type Props = {
  /** Valor ya conocido (por ejemplo, el que trae el chat abierto). */
  initial?: boolean;
  /** Aviso al contenedor para que refresque lo que dependa del permiso. */
  onChange?: (allowed: boolean) => void;
  compact?: boolean;
};

/**
 * Interruptor de fotos en el chat.
 *
 * Empieza apagado: mientras la profesional no lo active, los clientes no
 * pueden enviarle imágenes y el servidor rechaza el envío. Es lo que corta las
 * fotos que nadie pidió.
 */
export default function PhotoPermissionToggle({ initial, onChange, compact }: Props) {
  const [enabled, setEnabled] = useState<boolean | null>(
    initial === undefined ? null : initial,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<{ allowChatPhotos: boolean }>("/messages/photo-permission")
      .then((r) => { if (alive) setEnabled(Boolean(r?.allowChatPhotos)); })
      .catch(() => { if (alive && initial === undefined) setError(true); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setError(false);
    // Optimista: el interruptor responde al toque y se revierte si falla.
    setEnabled(next);
    try {
      const r = await apiFetch<{ allowChatPhotos: boolean }>(
        "/messages/photo-permission",
        { method: "PATCH", body: JSON.stringify({ allowChatPhotos: next }) },
      );
      const value = Boolean(r?.allowChatPhotos);
      setEnabled(value);
      onChange?.(value);
    } catch {
      setEnabled(!next);
      setError(true);
    } finally {
      setSaving(false);
    }
  }, [enabled, saving, onChange]);

  if (enabled === null && !error) {
    return <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  return (
    <div
      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      <div className="flex items-center gap-3">
        <ImageIcon className="h-4 w-4 shrink-0 text-white/30" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Recibir fotos</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">
            {enabled
              ? "Los clientes pueden enviarte imágenes en el chat."
              : "Apagado: nadie puede enviarte imágenes en el chat."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={Boolean(enabled)}
          aria-label="Permitir que los clientes me envíen fotos"
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
