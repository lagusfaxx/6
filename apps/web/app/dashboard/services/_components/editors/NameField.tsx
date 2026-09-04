"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { apiFetch } from "../../../../../lib/api";
import FloatingInput from "../FloatingInput";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/* Respaldo por si la API no manda el tope; el valor real llega en la
   respuesta de /profile/name-change. */
const DEFAULT_MAX_LENGTH = 20;

type NameChangeRequest = {
  id: string;
  requestedName: string;
  currentName: string | null;
  reason: string | null;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

type NameChangeState = {
  displayName: string | null;
  locked: boolean;
  maxLength?: number;
  request: NameChangeRequest | null;
};

/**
 * Nombre público. Para una profesional con nombre ya fijado el campo queda
 * bloqueado: es con lo que la reconocen quienes la tenían guardada o la vieron
 * recomendada, así que el cambio se pide y lo revisa el equipo. Mientras no
 * esté bloqueado (cuentas nuevas, otros tipos de perfil) se edita como
 * cualquier otro dato, con el mismo tope de largo que el registro.
 */
export default function NameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [state, setState] = useState<NameChangeState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    try {
      setState(await apiFetch<NameChangeState>("/profile/name-change"));
    } catch {
      // Sin respuesta se deja el campo editable: el backend igual bloquea.
      setState(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const pending = state?.request?.status === "PENDING" ? state.request : null;
  const rejected = state?.request?.status === "REJECTED" ? state.request : null;
  const locked = Boolean(state?.locked);
  const maxLength = state?.maxLength ?? DEFAULT_MAX_LENGTH;

  async function submit() {
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch("/profile/name-change", {
        method: "POST",
        body: JSON.stringify({ displayName: newName.trim(), reason: reason.trim() || null }),
      });
      setModalOpen(false);
      setNewName("");
      setReason("");
      setNotice("Solicitud enviada. El equipo la revisará pronto.");
      load();
    } catch (e: any) {
      setError(e?.message || "No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    if (!pending || sending) return;
    setSending(true);
    try {
      await apiFetch(`/profile/name-change/${pending.id}/cancel`, { method: "POST" });
      setNotice("Solicitud retirada.");
      load();
    } catch {
      setError("No se pudo retirar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  if (!locked) {
    return (
      <FloatingInput
        label="Nombre visible"
        value={value}
        onChange={(v) => onChange(v.slice(0, maxLength))}
        placeholder="Tu nombre o alias"
        hint={`Máximo ${maxLength} caracteres. Una vez guardado, cambiarlo requiere aprobación.`}
      />
    );
  }

  return (
    <div className="grid gap-1.5">
      <label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/40">
        Nombre visible
        <Lock className="h-3 w-3" />
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
        <span className="flex-1 text-sm text-white/80">{state?.displayName || value}</span>
        <button
          type="button"
          onClick={() => {
            setModalOpen(true);
            setError(null);
          }}
          disabled={Boolean(pending)}
          className="shrink-0 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20 disabled:opacity-40"
        >
          Solicitar cambio
        </button>
      </div>

      {pending ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2 text-[11px] text-amber-200">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>
            En revisión: <strong>{pending.requestedName}</strong>
          </span>
          <button
            type="button"
            onClick={cancel}
            disabled={sending}
            className="ml-auto text-amber-300/80 underline underline-offset-2 hover:text-amber-200 disabled:opacity-40"
          >
            Retirar
          </button>
        </div>
      ) : rejected ? (
        <p className="rounded-xl border border-red-500/20 bg-red-500/[0.07] px-3 py-2 text-[11px] text-red-200">
          Tu última solicitud ({rejected.requestedName}) fue rechazada
          {rejected.adminNote ? `: ${rejected.adminNote}` : "."}
        </p>
      ) : (
        <span className="text-[11px] text-white/30">
          Con este nombre te reconocen tus clientes, por eso el cambio lo revisa el equipo.
        </span>
      )}

      {notice && <span className="text-[11px] text-emerald-300">{notice}</span>}

      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0e0b16] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Solicitar cambio de nombre</h3>
                <p className="mt-1 text-[11px] text-white/40">
                  Actual: {state?.displayName || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar"
                className="rounded-full bg-white/10 p-1.5 text-white/70 transition hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <FloatingInput
                label="Nuevo nombre"
                value={newName}
                onChange={(v) => setNewName(v.slice(0, maxLength))}
                placeholder="Tu nombre o alias"
                hint={`Máximo ${maxLength} caracteres (${newName.trim().length}/${maxLength}).`}
              />
              <div className="grid gap-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wide text-white/40">
                  Motivo
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Cuéntanos por qué necesitas cambiarlo (ej: me equivoqué al registrarme)"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-fuchsia-500/40"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={sending || newName.trim().length < 2}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Enviar solicitud
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
