"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Zap } from "lucide-react";
import { apiFetch } from "../lib/api";
import QuickRepliesEditor from "./QuickRepliesEditor";
import {
  QUICK_REPLY_TOPICS,
  cleanQuickReplies,
  type QuickReplies,
  type QuickReplyKey,
} from "../lib/quickReplies";

type QuickRepliesResponse = {
  quickReplies: QuickReplies;
  missing: string[];
};

/**
 * Respuestas rápidas de la profesional: botones como "Tarifa" o "Servicios"
 * que el cliente toca en el chat para recibir la respuesta al instante.
 *
 * Parte siempre cerrado para no empujar la lista de chats hacia abajo. Si le
 * faltan las obligatorias (cuentas anteriores a la función) el botón cerrado
 * se destaca con un aviso para que lo abra y las complete.
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
  const [notice, setNotice] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<QuickReplyKey | null>(null);

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

  /* Se guarda lo que haya aunque falte una obligatoria: antes, quien
     completaba sólo la tarifa perdía lo escrito. Sigue "Pendiente" y se le
     dice qué le falta. */
  const save = async () => {
    if (saving) return;
    if (!Object.keys(cleanQuickReplies(value)).length) {
      setError("Escribe al menos tu tarifa para guardar.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const r = await apiFetch<QuickRepliesResponse>("/messages/quick-replies", {
        method: "PATCH",
        body: JSON.stringify({ quickReplies: cleanQuickReplies(value) }),
      });
      const replies = r?.quickReplies || {};
      setValue(replies);
      setSaved(replies);
      const stillMissing = QUICK_REPLY_TOPICS.filter((t) =>
        (r?.missing || []).includes(t.key),
      );
      setMissing(stillMissing.length > 0);
      if (stillMissing.length) {
        setNotice(
          `Guardado. Te falta ${stillMissing.map((t) => t.label).join(" y ")} para completarlas.`,
        );
        setFocusKey(null);
        setTimeout(() => setFocusKey(stillMissing[0].key), 0);
      } else {
        setJustSaved(true);
        setTimeout(() => setJustSaved(false), 2000);
      }
    } catch (err: any) {
      setError(err?.body?.message || "No pudimos guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  const dirty =
    JSON.stringify(cleanQuickReplies(value)) !== JSON.stringify(cleanQuickReplies(saved));

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        missing
          ? "border-amber-400/40 bg-gradient-to-r from-amber-500/[0.12] via-fuchsia-500/[0.06] to-transparent shadow-[0_0_24px_-8px_rgba(251,191,36,0.45)]"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
        aria-expanded={open}
      >
        {missing ? (
          <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/40" />
            <AlertCircle className="relative h-4 w-4 text-amber-300" />
          </span>
        ) : (
          <Zap className="h-4 w-4 shrink-0 text-white/30" />
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13px] font-medium">
            Respuestas rápidas
            {missing && (
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                Pendiente
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[11px] leading-tight text-white/40">
            {missing
              ? "Los clientes preguntan tu tarifa y no reciben respuesta. Complétalas en 1 minuto."
              : "Tarifa, servicios y más: el cliente los toca en tu chat y los recibe al instante."}
          </span>
        </span>
        {missing && !open ? (
          <span className="shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-fuchsia-600 px-3 py-1.5 text-[11px] font-semibold text-white shadow">
            Completar
          </span>
        ) : (
          <span className="shrink-0 text-[11px] text-fuchsia-300/80">
            {open ? "Cerrar" : "Editar"}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 grid gap-3">
          <QuickRepliesEditor
            value={value}
            onChange={(next) => {
              setValue(next);
              setNotice(null);
              setError(null);
            }}
            focusKey={focusKey}
          />
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

      {notice && <p className="mt-2 text-[12px] font-medium text-amber-200">{notice}</p>}
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
