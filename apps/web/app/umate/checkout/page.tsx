"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import { apiFetch } from "../../../lib/api";

function CheckoutContent() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "rejected" | "expired" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 8;

  const checkPayment = useCallback(async () => {
    if (!ref) { setStatus("error"); return; }
    try {
      const data = await apiFetch<{ status?: string }>(`/umate/payment/status?ref=${encodeURIComponent(ref)}`);
      if (data?.status === "paid") return setStatus("paid");
      if (data?.status === "rejected") return setStatus("rejected");
      if (data?.status === "expired") return setStatus("expired");
      if (data?.status === "pending") return setStatus("pending");
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }, [ref]);

  useEffect(() => { checkPayment(); }, [checkPayment]);

  // Auto-poll while pending: 5s intervals, increasing to 8s after 4 attempts
  useEffect(() => {
    if (status === "pending" && retryCount < maxRetries) {
      const delay = retryCount < 4 ? 5000 : 8000;
      const timer = setTimeout(() => {
        setRetryCount((c) => c + 1);
        checkPayment();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [status, retryCount, checkPayment]);

  const handleRetry = () => {
    setStatus("loading");
    setRetryCount(0);
    checkPayment();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center space-y-5">
      {status === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-white/45 mx-auto" />
          <p className="text-sm text-white/40">Verificando pago...</p>
        </>
      )}

      {status === "paid" && (
        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-10 space-y-5">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-emerald-400">Plan activado</h1>
          <p className="text-sm text-white/45">Tu suscripción U-Mate está activa. Ya puedes suscribirte a tus creadoras favoritas.</p>
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/umate/explore" className="rounded-full bg-[#00aff0] px-6 py-3 text-sm font-bold text-white shadow-[0_2px_16px_rgba(0,175,240,0.25)] transition-all duration-200 hover:bg-[#00aff0]/90 hover:shadow-[0_4px_24px_rgba(0,175,240,0.35)]">
              Explorar creadoras
            </Link>
            <Link href="/umate/account" className="rounded-full border border-white/[0.08] px-6 py-2.5 text-sm text-white/40 transition hover:text-white/60">
              Ver mi cuenta
            </Link>
          </div>
        </div>
      )}

      {status === "pending" && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-8 space-y-4">
          {retryCount < maxRetries ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto" />
              <h1 className="text-xl font-extrabold text-amber-400">Pago pendiente</h1>
              <p className="text-sm text-white/45">Tu pago está siendo procesado. Puede tardar unos minutos.</p>
              <div className="w-full bg-white/[0.06] rounded-full h-1.5 mt-2">
                <div
                  className="bg-amber-400/60 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${((retryCount + 1) / maxRetries) * 100}%` }}
                />
              </div>
              <p className="text-[11px] text-white/30">Verificando... intento {retryCount + 1}/{maxRetries}</p>
            </>
          ) : (
            <>
              <Clock className="h-10 w-10 text-amber-400 mx-auto" />
              <h1 className="text-xl font-extrabold text-amber-400">Aún pendiente</h1>
              <p className="text-sm text-white/45">El pago aún no se ha confirmado. Esto puede pasar si el banco tarda en procesar la transacción.</p>
              <p className="text-xs text-white/30">Si ya completaste el pago, espera unos minutos y verifica de nuevo.</p>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-amber-500/20 px-6 py-3 text-sm font-bold text-amber-400 transition hover:bg-amber-500/30"
                >
                  <RefreshCw className="h-4 w-4" /> Verificar de nuevo
                </button>
                <Link href="/umate/account" className="rounded-full border border-white/[0.08] px-6 py-2.5 text-sm text-white/40 transition hover:text-white/60">
                  Volver a mi cuenta
                </Link>
              </div>
            </>
          )}
        </div>
      )}

      {status === "rejected" && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-red-400">Pago rechazado</h1>
          <p className="text-sm text-white/45">Tu pago fue rechazado por la pasarela de pago. No se realizó ningún cargo.</p>
          <p className="text-xs text-white/30">Esto puede ocurrir por fondos insuficientes, tarjeta bloqueada o datos incorrectos.</p>
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/umate/plans" className="rounded-full bg-[#00aff0] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00aff0]/90">
              Intentar de nuevo
            </Link>
            <Link href="/umate/account" className="rounded-full border border-white/[0.08] px-6 py-2.5 text-sm text-white/40 transition hover:text-white/60">
              Volver a mi cuenta
            </Link>
          </div>
        </div>
      )}

      {status === "expired" && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06]">
              <AlertTriangle className="h-8 w-8 text-white/40" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-white/60">Pago expirado</h1>
          <p className="text-sm text-white/45">El tiempo para completar el pago ha expirado. No se realizó ningún cargo.</p>
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/umate/plans" className="rounded-full bg-[#00aff0] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00aff0]/90">
              Volver a planes
            </Link>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 space-y-4">
          <XCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-extrabold text-red-400">Error verificando pago</h1>
          <p className="text-sm text-white/45">No pudimos confirmar tu pago. Si ya pagaste, espera unos minutos e intenta verificar nuevamente.</p>
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.08] px-6 py-3 text-sm font-medium text-white/50 transition hover:text-white/70"
            >
              <RefreshCw className="h-4 w-4" /> Verificar de nuevo
            </button>
            <Link href="/umate/plans" className="rounded-full bg-[#00aff0] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00aff0]/90">
              Volver a planes
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/45" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
