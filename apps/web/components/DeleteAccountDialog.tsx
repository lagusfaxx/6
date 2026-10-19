"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { apiFetch, friendlyErrorMessage } from "../lib/api";

/*
 * Eliminar la cuenta profesional desde /cuenta. Sin el motivo (largo mínimo
 * que fija la API) no se elimina; si la cuenta tiene contraseña también se
 * pide. Es definitivo: los datos personales se borran y el perfil sale del
 * sitio.
 */
export default function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const [reasonMin, setReasonMin] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    apiFetch<{ hasPassword: boolean; reasonMin: number }>("/profile/delete-account")
      .then((r) => {
        setHasPassword(r.hasPassword);
        setReasonMin(r.reasonMin);
      })
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  const reasonLength = reason.trim().length;
  const canSubmit = reasonLength >= reasonMin && confirmed && (!hasPassword || password.length > 0) && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/profile/delete-account", {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim(), password }),
      });
      window.location.href = "/?cuenta=eliminada";
    } catch (err: any) {
      setError(err?.body?.message || friendlyErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#14101f] p-5 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-red-500/15">
              <AlertTriangle className="h-4.5 w-4.5 text-red-300" />
            </span>
            <h2 id="delete-account-title" className="text-base font-bold text-white">
              Eliminar mi cuenta
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-white/45 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Tu perfil dejará de aparecer y se borrarán tus fotos, historias y datos personales. No se puede deshacer: si
          quieres volver tendrás que registrarte de nuevo.
        </p>

        <label className="mt-4 block">
          <span className="text-xs font-medium text-white/70">¿Por qué te vas? (obligatorio)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Cuéntanos el motivo. Nos ayuda a mejorar."
            className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-fuchsia-500/40"
          />
          <span className={`mt-1 block text-right text-[11px] ${reasonLength >= reasonMin ? "text-emerald-300/80" : "text-white/40"}`}>
            {reasonLength >= reasonMin ? "Listo" : `Mínimo ${reasonMin} caracteres · faltan ${reasonMin - reasonLength}`}
          </span>
        </label>

        {hasPassword && (
          <label className="mt-2 block">
            <span className="text-xs font-medium text-white/70">Tu contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-fuchsia-500/40"
            />
          </label>
        )}

        <label className="mt-3 flex items-start gap-2.5 text-xs text-white/60">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-red-500"
          />
          Entiendo que mi cuenta se elimina de forma definitiva.
        </label>

        {error && <p className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy ? "Eliminando…" : "Eliminar cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}
