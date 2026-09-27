"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Zap } from "lucide-react";
import { apiFetch } from "../lib/api";
import QuickRepliesFields from "./QuickRepliesFields";
import {
  cleanQuickReplies,
  quickRepliesError,
  type QuickReplies,
} from "../lib/quickReplies";

type QuickRepliesResponse = {
  quickReplies: QuickReplies;
  missing: string[];
};

/**
 * Respuestas rápidas de la profesional: botones como "Tarifa" o "Servicios"
 * que el cliente toca en el chat para recibir la respuesta al instante.
 *
 * Si le faltan las obligatorias (cuentas anteriores a la función) se muestra
 * abierto y con aviso, para que las complete.
 */
export default function QuickRepliesSettings({
  defaultOpen = false,
}: {
  defaultOpen?: boolean;
}) {
  const [value, setValue] = useState<QuickReplies>({});
  const [saved, setSaved] = useState<QuickReplies>({});
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<QuickRepliesResponse>("/messages/quick-replies")
      .then((r) => {
        if (!alive) return;
        const replies = r?.quickReplies || {};
        setValue(replies);
        setSaved(replies);
        const isMissing = (r?.missing || []).length > 0;
        setMissing(isMissing);
        if (isMissing) setOpen(true);
      })
      .catch(() => {
        if (alive) setError("No pudimos cargar tus respuestas rápidas.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    if (saving) return;
    const validation = quickRepliesError(value);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await apiFetch<QuickRepliesResponse>("/messages/quick-replies", {
        method: "PATCH",
        body: JSON.stringify({ quickReplies: cleanQuickReplies(value) }),
      });
      const replies = r?.quickReplies || {};
      setValue(replies);
      setSaved(replies);
      setMissing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err: any) {
      setError(err?.body?.message || "No pudimos guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-16 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  const dirty =
    JSON.stringify(cleanQuickReplies(value)) !== JSON.stringify(cleanQuickReplies(saved));

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        missing ? "border-amber-400/30 bg-amber-400/[0.05]" : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        {missing ? (
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
        ) : (
          <Zap className="h-4 w-4 shrink-0 text-white/30" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium">Respuestas rápidas</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-white/40">
            {missing
              ? "Completa tu tarifa y tus servicios: los clientes los preguntan al abrir tu chat."
              : "Tarifa, servicios y más: el cliente los toca en tu chat y los recibe al instante."}
          </span>
        </span>
        <span className="shrink-0 text-[11px] text-fuchsia-300/80">
          {open ? "Cerrar" : "Editar"}
        </span>
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <QuickRepliesFields value={value} onChange={setValue} compact />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving || (!dirty && !missing)}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
            >
              {saving ? "Guardando..." : justSaved ? "Guardado" : "Guardar respuestas"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
