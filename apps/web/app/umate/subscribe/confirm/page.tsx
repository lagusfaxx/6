"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, CheckCircle, CreditCard, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "../../../../lib/api";

function ConfirmContent() {
  const params = useSearchParams();
  const creatorId = params.get("c");
  const token = params.get("token");

  const [status, setStatus] = useState<"loading" | "done" | "pending" | "rejected" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [subInfo, setSubInfo] = useState<{
    priceCLP?: number;
    cardBrand?: string | null;
    cardLast4?: string | null;
    creator?: { id: string; displayName: string; username: string };
  } | null>(null);

  useEffect(() => {
    if (!creatorId) {
      setStatus("error");
      setErrorMsg("Falta el identificador de la creadora.");
      return;
    }

    (async () => {
      try {
        const res = await apiFetch<{
          subscribed: boolean;
          activated: boolean;
          subscription: {
            id: string;
            priceCLP: number;
            cardBrand: string | null;
            cardLast4: string | null;
          };
        }>(`/umate/creators/${encodeURIComponent(creatorId)}/subscribe-direct/confirm`, {
          method: "POST",
          body: JSON.stringify(token ? { token } : {}),
        });

        // Fetch my subscriptions to get the creator info for display
        const list = await apiFetch<{ subscriptions: Array<any> }>("/umate/my-subscriptions").catch(() => null);
        const mine = list?.subscriptions?.find((s) => s.id === res.subscription.id);

        setSubInfo({
          priceCLP: res.subscription.priceCLP,
          cardBrand: res.subscription.cardBrand,
          cardLast4: res.subscription.cardLast4,
          creator: mine?.creator
            ? { id: mine.creator.id, displayName: mine.creator.displayName, username: mine.creator.username }
            : undefined,
        });
        setStatus("done");
      } catch (err: any) {
        const code = err?.body?.error;
        const msg = err?.body?.message || err?.message;
        if (code === "CARD_NOT_REGISTERED" && err?.body?.status === 0) {
          setStatus("pending");
        } else if (code === "CARD_NOT_REGISTERED") {
          setStatus("rejected");
          setErrorMsg(msg || "La tarjeta fue rechazada.");
        } else {
          setStatus("error");
          setErrorMsg(msg || "No pudimos activar tu suscripción.");
        }
      }
    })();
  }, [creatorId, token]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center space-y-5">
      {status === "loading" && (
        <>
          <Loader2 className="h-10 w-10 animate-spin text-[#00aff0]/70 mx-auto" />
          <p className="text-sm text-white/50">Confirmando tu suscripción...</p>
          <p className="text-xs text-white/30">Esto puede demorar unos segundos.</p>
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
            <h1 className="text-xl font-bold text-emerald-300">¡Suscripción activada!</h1>
            {subInfo?.creator?.displayName && (
              <p className="mt-2 text-sm text-white/70">
                Ya tienes acceso al contenido exclusivo de{" "}
                <strong className="text-white">{subInfo.creator.displayName}</strong>.
              </p>
            )}
            {subInfo?.priceCLP != null && (
              <p className="mt-1 text-xs text-white/40">
                ${subInfo.priceCLP.toLocaleString("es-CL")} CLP / mes · se renueva automáticamente con PAC
              </p>
            )}
            {subInfo?.cardLast4 && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-white/60">
                <CreditCard className="h-3 w-3 text-white/40" />
                {(subInfo.cardBrand || "tarjeta").toUpperCase()} · •• {subInfo.cardLast4}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2 pt-2">
            {subInfo?.creator?.username && (
              <Link
                href={`/umate/profile/${subInfo.creator.username}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-3 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] transition hover:shadow-[0_6px_28px_rgba(0,175,240,0.4)]"
              >
                Ver el perfil <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              href="/umate/account/subscriptions"
              className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] px-6 py-2.5 text-sm text-white/60 transition hover:border-white/20 hover:text-white/80"
            >
              Ir a mis suscripciones
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
            <p className="mt-2 text-sm text-white/50">
              El registro de tu tarjeta con Flow aún está en proceso. Intenta de nuevo en unos minutos.
            </p>
          </div>
          <Link
            href="/umate/explore"
            className="inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm text-white/60 hover:text-white transition"
          >
            Volver a explorar
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
              {status === "rejected" ? "Tarjeta rechazada" : "Error al confirmar"}
            </h1>
            <p className="mt-2 text-sm text-white/50">
              {errorMsg ||
                (status === "rejected"
                  ? "No pudimos registrar tu tarjeta. Intenta con otra."
                  : "No pudimos activar tu suscripción. Intenta de nuevo.")}
            </p>
          </div>
          <Link
            href="/umate/explore"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-3 text-sm font-semibold text-white transition"
          >
            Volver a explorar
          </Link>
        </div>
      )}
    </div>
  );
}

export default function UmateSubscribeConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/70" />
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
