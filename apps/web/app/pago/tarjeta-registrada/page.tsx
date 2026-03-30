"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2, XCircle, CreditCard } from "lucide-react";
import { apiFetch } from "../../../lib/api";

function TarjetaRegistradaContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "activating" | "done" | "pending" | "rejected" | "error">("loading");
  const [cardInfo, setCardInfo] = useState<{ type?: string; last4?: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus("error"); return; }

    // Step 1: Check card registration
    apiFetch<{
      registered: boolean;
      status: number;
      creditCardType?: string;
      last4CardDigits?: string;
    }>(`/billing/subscription/register-status?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        if (!data.registered) {
          setStatus(data.status === 0 ? "pending" : "rejected");
          return;
        }

        setCardInfo({ type: data.creditCardType || undefined, last4: data.last4CardDigits || undefined });
        setStatus("activating");

        // Step 2: Auto-create subscription immediately
        try {
          await apiFetch("/billing/subscription/start", { method: "POST", body: JSON.stringify({}) });
          setStatus("done");
        } catch (err: any) {
          console.error("[tarjeta-registrada] subscription start error", err);
          setErrorMsg(err?.body?.message || err?.message || "Error al activar la suscripción.");
          setStatus("error");
        }
      })
      .catch((err) => {
        console.error("[tarjeta-registrada] register-status error", err);
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="mx-auto max-w-md px-4 py-12 text-center space-y-5">
      {(status === "loading" || status === "activating") && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-fuchsia-400 mx-auto" />
          <p className="text-sm text-white/50">
            {status === "loading" ? "Verificando registro de tarjeta..." : "Activando pago automatico..."}
          </p>
          {cardInfo?.type && cardInfo?.last4 && (
            <p className="text-xs text-white/30">{cardInfo.type} terminada en {cardInfo.last4}</p>
          )}
        </>
      )}

      {status === "done" && (
        <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-emerald-300">Pago automatico activado</h1>
            <p className="mt-2 text-sm text-white/50">
              {cardInfo?.type && cardInfo?.last4
                ? `${cardInfo.type} terminada en ${cardInfo.last4}`
                : "Tu tarjeta fue registrada exitosamente."}
            </p>
            <p className="mt-1 text-sm text-white/50">
              Tu plan se renovara automaticamente cada mes. No necesitas hacer nada mas.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <Link href="/cuenta" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white hover:shadow-[0_0_20px_rgba(168,85,247,0.35)] transition">
              Ir a mi cuenta
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
            <h1 className="text-xl font-bold text-amber-300">Registro pendiente</h1>
            <p className="mt-2 text-sm text-white/50">El registro de tu tarjeta aun esta en proceso. Intenta de nuevo en unos minutos.</p>
          </div>
          <Link href="/pago" className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 hover:text-white transition">
            Volver a opciones de pago
          </Link>
        </div>
      )}

      {(status === "rejected" || status === "error") && (
        <div className="rounded-3xl border border-red-500/25 bg-red-500/[0.05] p-8 space-y-4">
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 border border-red-500/25">
              <XCircle className="h-8 w-8 text-red-400" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-red-300">
              {status === "rejected" ? "Tarjeta rechazada" : "Error al activar"}
            </h1>
            <p className="mt-2 text-sm text-white/50">
              {status === "rejected"
                ? "No se pudo registrar tu tarjeta. Intenta con otra tarjeta."
                : errorMsg || "No pudimos activar tu suscripcion. Intenta de nuevo."}
            </p>
          </div>
          <Link href="/pago" className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-3 text-sm font-semibold text-white transition">
            Intentar de nuevo
          </Link>
        </div>
      )}
    </div>
  );
}

export default function TarjetaRegistradaPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-fuchsia-400" />
      </div>
    }>
      <TarjetaRegistradaContent />
    </Suspense>
  );
}
