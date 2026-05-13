"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert, X } from "lucide-react";

type Props = {
  open: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (code: string) => Promise<void> | void;
};

/**
 * Modal that asks the admin for a fresh Google Authenticator code before
 * performing a destructive action. The `onConfirm` handler receives the
 * 6-digit code; throwing inside it keeps the modal open and displays the
 * error so the admin can retry.
 */
export default function MfaConfirmDialog({
  open,
  title = "Confirma con tu código",
  description = "Por seguridad, ingresa el código de 6 dígitos de tu app Google Authenticator para continuar.",
  confirmLabel = "Confirmar",
  destructive = false,
  onCancel,
  onConfirm,
}: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setLoading(false);
      // Focus on next tick after layout
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm(code);
    } catch (err: any) {
      setError(err?.body?.message || err?.message || "Código inválido");
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#11121d] p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 rounded-full p-1.5 text-white/40 hover:bg-white/[0.06] hover:text-white/80 transition"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              destructive ? "bg-red-500/15 text-red-300" : "bg-fuchsia-500/15 text-fuchsia-300"
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{title}</h3>
            <p className="mt-1 text-xs text-white/55 leading-relaxed">{description}</p>
          </div>
        </div>

        <input
          ref={inputRef}
          className="input text-center tracking-[0.4em] text-lg"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          maxLength={6}
          required
        />

        {error && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] py-2.5 text-sm text-white/75 hover:bg-white/[0.08] transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className={`flex-1 rounded-xl py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
              destructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-fuchsia-600 hover:bg-fuchsia-500"
            }`}
          >
            {loading ? "Verificando..." : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
