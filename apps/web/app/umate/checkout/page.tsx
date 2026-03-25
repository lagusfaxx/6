"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "../../../lib/api";

function CheckoutContent() {
  const params = useSearchParams();
  const ref = params.get("ref");
  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");

  useEffect(() => {
    if (!ref) { setStatus("error"); return; }

    fetch(`/api/billing/status?ref=${encodeURIComponent(ref)}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const data = await response.json() as { status?: string };
        if (data?.status === "paid") return setStatus("paid");
        if (data?.status === "pending") return setStatus("pending");
        return setStatus("error");
      })
      .catch(() => setStatus("error"));
  }, [ref]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center space-y-5">
      {status === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-rose-400 mx-auto" />
          <p className="text-sm text-white/50">Verificando pago...</p>
        </>
      )}

      {status === "paid" && (
        <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-emerald-300">¡Plan activado!</h1>
          <p className="text-sm text-white/50">Tu suscripción U-Mate está activa. Ya puedes suscribirte a tus creadoras favoritas.</p>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/umate/explore" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white transition">
              Explorar creadoras
            </Link>
            <Link href="/umate/account" className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 hover:text-white transition">
              Ver mi cuenta
            </Link>
          </div>
        </div>
      )}

      {status === "pending" && (
        <div className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.05] p-8 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold text-amber-300">Pago pendiente</h1>
          <p className="text-sm text-white/50">Tu pago está siendo procesado. Puede tardar unos minutos.</p>
          <Link href="/umate/account" className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 transition">
            Volver a mi cuenta
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-3xl border border-red-500/25 bg-red-500/[0.05] p-8 space-y-4">
          <XCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-red-300">Error verificando pago</h1>
          <p className="text-sm text-white/50">No pudimos confirmar tu pago. Si ya pagaste, espera unos minutos.</p>
          <div className="flex flex-col gap-2">
            <Link href="/umate/plans" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 px-6 py-3 text-sm font-semibold text-white transition">
              Intentar de nuevo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-rose-400" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
