"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, X, Loader2 } from "lucide-react";
import type { StepUpRunner } from "../hooks/useStepUp";

// Minimal modal that pairs with useStepUp(). Drop both into any admin page
// that performs destructive actions; the backend will surface
// STEP_UP_REQUIRED automatically and this component will gather the code.
//
//   const stepUp = useStepUp();
//   <StepUpModal runner={stepUp} />
//   await stepUp.run(() => apiFetch(`/admin/profiles/${id}`, { method: "DELETE" }));

export default function StepUpModal({ runner }: { runner: StepUpRunner }) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!runner.isPrompting) {
      setCode("");
    }
  }, [runner.isPrompting]);

  if (!runner.isPrompting) return null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    await runner.submitCode(code);
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0d0e1a] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 border border-emerald-400/30">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Verificación requerida</h2>
              <p className="text-[11px] text-white/50">Confirma con Google Authenticator</p>
            </div>
          </div>
          <button
            onClick={runner.cancel}
            className="rounded-md p-1 text-white/40 hover:text-white/70"
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-4 text-xs text-white/60">
          Esta acción es sensible: ingresa el código de 6 dígitos que muestra tu app de autenticación.
        </p>

        <form onSubmit={onSubmit} className="mt-4 grid gap-3">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="123456"
            maxLength={6}
            autoFocus
            autoComplete="one-time-code"
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-3 text-center font-mono text-2xl tracking-widest text-white"
          />

          {runner.error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {runner.error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={runner.cancel}
              className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={runner.submitting || code.length !== 6}
              className="flex-1 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {runner.submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
