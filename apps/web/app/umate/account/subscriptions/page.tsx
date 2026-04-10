"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Compass,
  CreditCard,
  Crown,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../../lib/api";

type Subscription = {
  id: string;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
  priceCLP: number;
  cardBrand: string | null;
  cardLast4: string | null;
  cardHolderName: string | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  creator: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    username: string;
  };
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric" });
}

function daysRemaining(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function formatCardNumber(brand: string | null, last4: string | null) {
  if (!last4) return "—";
  return `•••• •••• •••• ${last4}`;
}

function brandLabel(brand: string | null): string {
  if (!brand) return "Tarjeta";
  const map: Record<string, string> = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
    discover: "Discover",
    jcb: "JCB",
    card: "Tarjeta",
  };
  return map[brand] || "Tarjeta";
}

export default function MySubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await apiFetch<{ subscriptions: Subscription[] }>("/umate/my-subscriptions").catch(() => null);
    setSubs(data?.subscriptions || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCancel = async (id: string) => {
    setCancelling(true);
    const res = await apiFetch<{ cancelled: boolean }>(`/umate/direct-subscriptions/${id}/cancel`, {
      method: "POST",
    }).catch(() => null);
    setCancelling(false);
    if (res?.cancelled) {
      setConfirmCancelId(null);
      await load();
    }
  };

  const handleReactivate = async (id: string) => {
    const res = await apiFetch<{ reactivated: boolean }>(`/umate/direct-subscriptions/${id}/reactivate`, {
      method: "POST",
    }).catch(() => null);
    if (res?.reactivated) {
      await load();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#00aff0]/60" />
        <p className="text-xs text-white/30">Cargando suscripciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">Mis suscripciones</h1>
        <p className="mt-1 text-sm text-white/30">Gestiona tus suscripciones a creadoras y tus métodos de pago recurrentes (PAC).</p>
      </div>

      {subs.length === 0 ? (
        <section className="rounded-2xl border border-white/[0.04] bg-gradient-to-br from-white/[0.02] to-transparent p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#00aff0]/[0.08]">
            <Crown className="h-7 w-7 text-[#00aff0]/70" />
          </div>
          <p className="text-sm font-semibold text-white/60">No tienes suscripciones activas</p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs text-white/30">
            Suscríbete a tus creadoras favoritas para desbloquear su contenido exclusivo.
          </p>
          <Link
            href="/umate/explore"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#00aff0] to-[#0090d0] px-6 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(0,175,240,0.3)] transition hover:shadow-[0_6px_28px_rgba(0,175,240,0.4)]"
          >
            <Compass className="h-4 w-4" /> Explorar creadoras
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {subs.map((sub) => {
            const days = daysRemaining(sub.currentPeriodEnd);
            const isCancelled = sub.status === "CANCELLED";
            return (
              <section
                key={sub.id}
                className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm transition hover:border-white/[0.1]"
              >
                {/* Header: creator info */}
                <div className="flex items-center gap-3 border-b border-white/[0.04] p-5">
                  <Link href={`/umate/profile/${sub.creator.username}`} className="flex flex-1 items-center gap-3 min-w-0 transition hover:opacity-80">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
                      {sub.creator.avatarUrl ? (
                        <img src={resolveMediaUrl(sub.creator.avatarUrl) || ""} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-base font-bold text-white/50">
                          {(sub.creator.displayName || "?")[0]}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-white">{sub.creator.displayName}</p>
                      <p className="text-xs text-white/30">@{sub.creator.username}</p>
                    </div>
                  </Link>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-white/30">Tarifa mensual</p>
                    <p className="text-base font-extrabold text-white">${sub.priceCLP.toLocaleString("es-CL")}</p>
                  </div>
                </div>

                {/* Body: period + card + actions */}
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {/* Period */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                      <Calendar className="h-3 w-3" /> Periodo actual
                    </div>
                    <p className="mt-2 text-sm font-semibold text-white/80">
                      {days} día{days === 1 ? "" : "s"} restante{days === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-[11px] text-white/40">
                      Del {formatDate(sub.currentPeriodStart)}
                      <br />
                      al {formatDate(sub.currentPeriodEnd)}
                    </p>
                    {isCancelled ? (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                        <AlertCircle className="h-2.5 w-2.5" /> Cancelada — termina el {formatDate(sub.currentPeriodEnd)}
                      </div>
                    ) : (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Se renueva automáticamente (PAC)
                      </div>
                    )}
                  </div>

                  {/* Card */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/35">
                      <CreditCard className="h-3 w-3" /> Pagada con
                    </div>
                    <p className="mt-2 font-mono text-sm tracking-widest text-white/80">
                      {formatCardNumber(sub.cardBrand, sub.cardLast4)}
                    </p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {brandLabel(sub.cardBrand)}
                      {sub.cardHolderName ? ` · ${sub.cardHolderName}` : ""}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] bg-white/[0.01] px-5 py-3">
                  <Link
                    href={`/umate/profile/${sub.creator.username}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00aff0]/80 transition hover:text-[#00aff0]"
                  >
                    Ver perfil <ArrowRight className="h-3 w-3" />
                  </Link>
                  {isCancelled ? (
                    <button
                      onClick={() => handleReactivate(sub.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#00aff0]/[0.1] border border-[#00aff0]/20 px-4 py-2 text-xs font-bold text-[#00aff0] transition hover:bg-[#00aff0]/[0.15]"
                    >
                      Reactivar
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmCancelId(sub.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/15 px-4 py-2 text-xs font-medium text-red-400/70 transition hover:bg-red-500/[0.06] hover:text-red-400"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancelar suscripción
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Confirm cancel modal */}
      {confirmCancelId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
          onClick={() => !cancelling && setConfirmCancelId(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-white/[0.08] bg-[#0b0b14] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-center text-lg font-extrabold text-white">¿Cancelar suscripción?</h3>
            <p className="mt-2 text-center text-sm text-white/50 leading-relaxed">
              Mantendrás el acceso al contenido hasta el <strong className="text-white/80">fin del periodo actual</strong>.
              Al terminar se dejará de cobrar automáticamente con PAC.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmCancelId(null)}
                disabled={cancelling}
                className="flex-1 rounded-xl border border-white/[0.08] px-4 py-3 text-sm font-semibold text-white/60 transition hover:border-white/20 hover:text-white/80 disabled:opacity-50"
              >
                Mantener
              </button>
              <button
                onClick={() => handleCancel(confirmCancelId)}
                disabled={cancelling}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sí, cancelar"}
              </button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-white/30">
              <ShieldCheck className="h-3 w-3" /> Cancelación segura. Sin cargos futuros.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
