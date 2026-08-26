"use client";

import { useCallback, useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { apiFetch } from "../lib/api";

type AutoReplyPrefs = {
  autoReplyEnabled: boolean;
  autoReplyMessage: string;
};

const MAX_LENGTH = 500;

/**
 * Mensaje automático de la profesional.
 *
 * Se envía solo 20 segundos después de que un cliente escribe, y no cuenta
 * como respuesta suya: el mensaje del cliente sigue sin leer y su aviso se
 * mantiene hasta que ella abre el chat.
 */
export default function AutoReplySettings() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    apiFetch<AutoReplyPrefs>("/messages/auto-reply")
      .then((r) => {
        if (!alive) return;
        setEnabled(Boolean(r?.autoReplyEnabled));
        setMessage(r?.autoReplyMessage || "");
        setSavedMessage(r?.autoReplyMessage || "");
      })
      .catch(() => {
        if (alive) setError("No pudimos cargar tu mensaje automático.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(
    async (next: Partial<AutoReplyPrefs>) => {
      setSaving(true);
      setError(null);
      try {
        const r = await apiFetch<AutoReplyPrefs>("/messages/auto-reply", {
          method: "PATCH",
          body: JSON.stringify(next),
        });
        setEnabled(Boolean(r?.autoReplyEnabled));
        setMessage(r?.autoReplyMessage || "");
        setSavedMessage(r?.autoReplyMessage || "");
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        return true;
      } catch (err: any) {
        setError(
          err?.body?.message ||
            "No pudimos guardar el mensaje. Inténtalo de nuevo.",
        );
        return false;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const toggle = async () => {
    if (saving) return;
    const next = !enabled;
    if (next && message.trim().length < 5) {
      setEnabled(true);
      setError("Escribe tu mensaje y guárdalo para activarlo.");
      return;
    }
    await persist(
      next
        ? { autoReplyEnabled: true, autoReplyMessage: message.trim() }
        : { autoReplyEnabled: false },
    );
  };

  const save = async () => {
    if (saving) return;
    const body = message.trim();
    if (enabled && body.length < 5) {
      setError("El mensaje debe tener al menos 5 caracteres.");
      return;
    }
    await persist({ autoReplyEnabled: enabled && body.length > 0, autoReplyMessage: body });
  };

  if (loading) {
    return <div className="h-24 animate-pulse rounded-xl bg-white/[0.04]" />;
  }

  const dirty = message.trim() !== savedMessage.trim();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-4 w-4 shrink-0 text-white/30" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium">Mensaje automático</p>
          <p className="mt-0.5 text-[11px] leading-tight text-white/40">
            Se envía solo cuando un cliente te escribe. Tu aviso de mensaje nuevo
            sigue igual: tienes que abrir el chat para responderle.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Activar mensaje automático"
          onClick={toggle}
          disabled={saving}
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

      {enabled && (
        <div className="mt-3 grid gap-2">
          <textarea
            className="input min-h-[90px]"
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
            placeholder="Hola, gracias por escribirme. En un rato te respondo."
            maxLength={MAX_LENGTH}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-white/35">
              {message.length}/{MAX_LENGTH}
            </span>
            <button
              type="button"
              onClick={save}
              disabled={saving || (!dirty && !error)}
              className="rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-1.5 text-xs font-medium text-white transition disabled:opacity-40"
            >
              {saving ? "Guardando..." : saved ? "Guardado" : "Guardar mensaje"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
