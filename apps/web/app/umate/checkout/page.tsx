"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle, RefreshCw } from "lucide-react";
import { apiFetch } from "../../../lib/api";

function CheckoutContent() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);

  const checkPayment = useCallback(async () => {
    if (!ref) { setStatus("error"); return; }
    try {
      const data = await apiFetch<{ status?: string }>(`/billing/status?ref=${encodeURIComponent(ref)}`);
      if (data?.status === "paid") return setStatus("paid");
      if (data?.status === "pending") return setStatus("pending");
      setStatus("error");
    } catch {
      setStatus("error");
    }
  }, [ref]);

  useEffect(() => { checkPayment(); }, [checkPayment]);

  useEffect(() => {
    if (status === "pending" && retryCount < 3) {
      const timer = setTimeout(() => {
        setRetryCount((c) => c + 1);
        checkPayment();
      }, 5000);
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
          <Loader2 className="h-10 w-10 animate-spin text-white/20 mx-auto" />
          <p className="text-sm text-white/30">Verificando pago...</p>
        </>
      )}

      {status === "paid" && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-extrabold text-emerald-400">Plan activado</h1>
          <p className="text-sm text-white/35">Tu suscripción U-Mate está activa. Ya puedes suscribirte a tus creadoras favoritas.</p>
          <div className="flex flex-col gap-3 pt-2">
            <Link href="/umate/explore" className="rounded-full bg-[#00aff0] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#00aff0]/90">
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
          <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto" />
          <h1 className="text-xl font-extrabold text-amber-400">Pago pendiente</h1>
          <p className="text-sm text-white/35">Tu pago está siendo procesado. Puede tardar unos minutos.</p>
          <p className="text-[11px] text-white/15">Verificación automática: intento {retryCount + 1}/4</p>
          <Link href="/umate/account" className="inline-block rounded-full border border-white/[0.08] px-6 py-2.5 text-sm text-white/40 transition hover:text-white/60">
            Volver a mi cuenta
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 space-y-4">
          <XCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-extrabold text-red-400">Error verificando pago</h1>
          <p className="text-sm text-white/35">No pudimos confirmar tu pago. Si ya pagaste, espera unos minutos e intenta verificar nuevamente.</p>
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
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-white/20" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
