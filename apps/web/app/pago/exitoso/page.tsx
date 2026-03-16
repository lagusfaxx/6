"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

function ExitosoContent() {
  const params = useSearchParams();
  const ref = params.get("ref");

  const [status, setStatus] = useState<"loading" | "paid" | "pending" | "error">("loading");

  useEffect(() => {
    if (!ref) { setStatus("error"); return; }

    // Payment gateway return page: only query backend status by ref.
    fetch(`/api/billing/status?ref=${encodeURIComponent(ref)}`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP_${response.status}`);
        const data = await response.json() as { status?: "paid" | "pending" | "error" };
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
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-400 mx-auto" />
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
          <div>
            <h1 className="text-xl font-bold text-emerald-300">Pago aprobado</h1>
            <p className="mt-2 text-sm text-white/50">Tu suscripción mensual está activa. Ya puedes usar todas las funciones de tu perfil profesional.</p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/cuenta" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] transition">
              Ir a mi cuenta
            </Link>
            <Link href="/dashboard/services" className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition">
              Completar mi perfil
            </Link>
          </div>
        </div>
      )}

      {status === "pending" && (
        <div className="rounded-3xl border border-amber-500/25 bg-amber-500/[0.05] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15 border border-amber-500/25">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-amber-300">Pago pendiente</h1>
            <p className="mt-2 text-sm text-white/50">Tu pago está siendo procesado. Puede tardar unos minutos en confirmarse. Recibirás una notificación cuando esté listo.</p>
          </div>
          <Link href="/cuenta" className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/[0.06] transition">
            Volver a mi cuenta
          </Link>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-3xl border border-red-500/25 bg-red-500/[0.05] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 border border-red-500/25">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-300">Error verificando pago</h1>
            <p className="mt-2 text-sm text-white/50">No pudimos confirmar tu pago en este momento. Si realizaste el pago, espera unos minutos y revisa tu cuenta.</p>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/cuenta" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white transition">
              Ver mi cuenta
            </Link>
            <Link href="/pago" className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 hover:text-white transition">
              Intentar de nuevo
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PagoExitosoPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
      </div>
    }>
      <ExitosoContent />
    </Suspense>
  );
}
