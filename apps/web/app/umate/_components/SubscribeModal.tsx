"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CreditCard, Crown, ExternalLink, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type Creator = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  monthlyPriceCLP: number;
  user?: { username?: string };
};

export default function SubscribeModal({
  creator,
  open,
  onClose,
  onSuccess,
}: {
  creator: Creator;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setError(null);
  }, [open]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const priceStr = `$${creator.monthlyPriceCLP.toLocaleString("es-CL")} CLP`;

  const handleContinue = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiFetch<{
        registered: boolean;
        url?: string;
        confirmUrl?: string;
      }>(`/umate/creators/${creator.id}/subscribe-direct`, { method: "POST" });

      if (res.registered) {
        // User already has a card on file (e.g. Uzeed Pro) — confirm directly
        const confirmRes = await apiFetch<{ subscribed: boolean }>(
          `/umate/creators/${creator.id}/subscribe-direct/confirm`,
          { method: "POST", body: JSON.stringify({}) },
        );
        if (confirmRes.subscribed) {
          onSuccess();
          onClose();
          return;
        }
        throw new Error("No se pudo confirmar la suscripción.");
      }

      // New card — redirect to Flow's hosted card enrollment page
      if (res.url) {
        window.location.href = res.url;
        return;
      }
      throw new Error("Respuesta inesperada del servidor.");
    } catch (err: any) {
      const msg = err?.body?.message || err?.body?.error || err?.message || "No se pudo iniciar el pago.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-uzeed-900 shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_48px_rgba(0,175,240,0.08)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#00aff0] to-transparent" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.06] text-white/60 transition hover:bg-white/[0.1] hover:text-white disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-6 pt-7 pb-6">
          {/* Creator header */}
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] shadow-[0_4px_18px_rgba(0,175,240,0.15)]">
              {creator.avatarUrl ? (
                <img src={resolveMediaUrl(creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-lg font-bold text-white/50">
                  {(creator.displayName || "?")[0]}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#00aff0]/80">Suscribirse a</p>
              <p className="truncate text-lg font-extrabold text-white">{creator.displayName}</p>
              {creator.user?.username && (
                <p className="truncate text-xs text-white/40">@{creator.user.username}</p>
              )}
            </div>
          </div>

          {/* Price box */}
          <div className="mt-5 rounded-2xl border border-[#00aff0]/15 bg-gradient-to-br from-[#00aff0]/[0.08] via-[#00aff0]/[0.03] to-transparent p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Tarifa mensual</p>
                <p className="mt-1 text-2xl font-extrabold text-white">{priceStr}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#00aff0]/15">
                <Crown className="h-5 w-5 text-[#00aff0]" />
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-[11px] text-white/50">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-[#00aff0]" /> Acceso total al contenido premium
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-[#00aff0]" /> Renovación automática con PAC
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-[#00aff0]" /> Cancela cuando quieras
              </li>
            </ul>
          </div>

          {/* Explainer */}
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05]">
              <CreditCard className="h-4 w-4 text-white/60" />
            </div>
            <div className="min-w-0 text-[12px] leading-relaxed text-white/55">
              Te vamos a llevar al sitio seguro de <strong className="text-white/80">Flow</strong> para
              registrar tu tarjeta. Los datos de la tarjeta <strong className="text-white/80">nunca</strong>
              {" "}pasan por nuestros servidores. Al volver, tu suscripción queda activada y se renovará
              automáticamente cada mes con PAC.
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5 text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-3.5 text-sm font-bold text-white shadow-[0_6px_28px_rgba(0,175,240,0.35)] transition hover:shadow-[0_8px_36px_rgba(0,175,240,0.5)] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Conectando con Flow...
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" /> Continuar a Flow · {priceStr}/mes <ExternalLink className="h-3.5 w-3.5 opacity-80" />
              </>
            )}
          </button>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/30">
            <ShieldCheck className="h-3 w-3" /> Pago seguro con Flow · PAC recurrente · Cancela cuando quieras
          </p>
        </div>
      </div>
    </div>
  );
}
