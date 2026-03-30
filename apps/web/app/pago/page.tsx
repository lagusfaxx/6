"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard, Banknote, CheckCircle, Loader2, ChevronLeft,
  Copy, Check, AlertCircle, Shield, Zap, Calendar, RefreshCw, XCircle,
} from "lucide-react";
import { apiFetch } from "../../lib/api";
import useSubscriptionStatus from "../../hooks/useSubscriptionStatus";
import useMe from "../../hooks/useMe";

// ── Bank account details for direct transfers ──
const BANK_INFO = {
  bank: "Banco de Chile",
  accountType: "Cuenta Vista",
  accountNumber: "00-007-96260-84",
  rut: "78.374.984-K",
  name: "APLICATIVOS MOVILES Y SERVICIOS PUBLICITARIOS SpA",
  email: "pagos@uzeed.cl",
};

type Tab = "pac" | "flow" | "transfer";

export default function PagoPage() {
  const router = useRouter();
  const { me } = useMe();
  const { status: sub, loading: subLoading } = useSubscriptionStatus();

  const [tab, setTab] = useState<Tab>("pac");

  // PAC subscription state
  const [pacBusy, setPacBusy] = useState(false);
  const [pacError, setPacError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  // Flow payment state
  const [flowBusy, setFlowBusy] = useState(false);
  const [flowError, setFlowError] = useState<string | null>(null);

  // Transfer form state
  const [folio, setFolio] = useState("");
  const [bank, setBank] = useState("");
  const [notes, setNotes] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferDone, setTransferDone] = useState(false);

  // Copy helper
  const [copied, setCopied] = useState<string | null>(null);
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const user = me?.user;
  const price = sub?.subscriptionPrice ?? 4990;
  const isActive = sub?.isActive;
  const hasPAC = sub?.flowSubscriptionId && sub?.flowSubscriptionStatus === "active";
  const canPayOneTime = !isActive || (sub?.daysRemaining ?? 0) <= 3; // Can only do one-time payment when <=3 days remain

  // ── PAC: Step 1 — Register card (redirects to Flow) ──────────────
  const handleStartPAC = async () => {
    setPacError(null);
    setPacBusy(true);
    try {
      const data = await apiFetch<{ url: string; token: string }>("/billing/subscription/register-card", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (data?.url) {
        // Redirect to Flow card enrollment page
        window.location.href = data.url;
      } else {
        setPacError("No se pudo iniciar el registro de tarjeta. Intenta de nuevo.");
      }
    } catch (err: any) {
      setPacError(err?.body?.message || err?.message || "Error al iniciar el registro de tarjeta.");
    } finally {
      setPacBusy(false);
    }
  };

  // ── Cancel PAC ───────────────────────────────────────────────────
  const handleCancelPAC = async () => {
    setCancelBusy(true);
    try {
      await apiFetch("/billing/subscription/cancel", { method: "POST" });
      setCancelDone(true);
    } catch (err: any) {
      setPacError(err?.body?.message || err?.message || "Error al cancelar la suscripción.");
    } finally {
      setCancelBusy(false);
    }
  };

  // ── Flow payment ──────────────────────────────────────────────────
  const handleFlowPay = async () => {
    setFlowError(null);
    setFlowBusy(true);
    try {
      const data = await apiFetch<{ url: string }>("/billing/payment/flow", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setFlowError("No se pudo obtener la URL de pago. Intenta de nuevo.");
      }
    } catch (err: any) {
      setFlowError(err?.body?.message || err?.message || "Error al iniciar el pago con Flow.");
    } finally {
      setFlowBusy(false);
    }
  };

  // ── Transfer submission ───────────────────────────────────────────
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folio.trim()) {
      setTransferError("Debes ingresar el número de folio o comprobante.");
      return;
    }
    setTransferError(null);
    setTransferBusy(true);
    try {
      await apiFetch("/billing/payment/transfer", {
        method: "POST",
        body: JSON.stringify({ folio: folio.trim(), bank: bank.trim() || undefined, notes: notes.trim() || undefined }),
      });
      setTransferDone(true);
    } catch (err: any) {
      setTransferError(err?.body?.message || err?.message || "Error al enviar el comprobante.");
    } finally {
      setTransferBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24">
      {/* Back */}
      <Link href="/cuenta" className="mb-5 inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver a mi cuenta
      </Link>

      {/* Plan card */}
      <div className="mb-6 rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-violet-600/10 via-fuchsia-500/5 to-transparent p-5 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/50 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-fuchsia-400/70 mb-1">Plan Profesional</p>
            <h1 className="text-2xl font-bold tracking-tight">
              ${price.toLocaleString("es-CL")}
              <span className="text-base font-normal text-white/40 ml-1">CLP/mes</span>
            </h1>
            {isActive && sub?.daysRemaining ? (
              <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Activa — vence en {sub.daysRemaining} días
                {hasPAC && <span className="text-fuchsia-400 ml-1">(renovación automática)</span>}
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/40">Renueva tu suscripción mensual</p>
            )}
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20">
            <Zap className="h-6 w-6 text-fuchsia-400" />
          </div>
        </div>

        {/* Included */}
        <ul className="mt-4 space-y-1.5">
          {["Perfil visible en directorio y búsquedas", "Mensajes directos con clientes", "Estadísticas de visitas", "Soporte prioritario"].map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs text-white/60">
              <CheckCircle className="h-3.5 w-3.5 text-fuchsia-400 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Active PAC info banner */}
      {hasPAC && !cancelDone && (
        <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-400" />
            <p className="text-sm font-medium text-emerald-300">Pago automático activo</p>
          </div>
          <p className="text-xs text-white/50">
            {sub?.flowCardType && sub?.flowCardLast4
              ? `${sub.flowCardType} terminada en ${sub.flowCardLast4} — tu plan se renueva automáticamente cada mes.`
              : "Tu plan se renueva automáticamente cada mes. No necesitas hacer nada."}
          </p>
          <button
            onClick={handleCancelPAC}
            disabled={cancelBusy}
            className="text-xs text-red-400/70 hover:text-red-400 transition underline underline-offset-2"
          >
            {cancelBusy ? "Cancelando..." : "Cancelar pago automático"}
          </button>
        </div>
      )}

      {cancelDone && (
        <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <p className="text-sm text-amber-300">Suscripción cancelada. Mantendrás acceso hasta el fin del periodo actual.</p>
        </div>
      )}

      {/* If membership active (>3 days) and no PAC, show info instead of payment options */}
      {!hasPAC && isActive && sub?.daysRemaining && sub.daysRemaining > 3 && (
        <div className="mb-4 rounded-2xl border border-violet-500/20 bg-violet-500/[0.06] p-4 space-y-3">
          <p className="text-sm text-violet-300 font-medium">Tu plan está activo</p>
          <p className="text-xs text-white/50">
            Te quedan {sub.daysRemaining} días. Podrás renovar cuando falten 3 días o menos.
          </p>
          <p className="text-xs text-white/40">
            Si prefieres no preocuparte por renovaciones, activa el pago automático (PAC) a continuación.
          </p>
        </div>
      )}

      {/* Payment method selector — only show if no active PAC or user wants to change */}
      {!hasPAC && (
        <>
          <div className="mb-4 flex rounded-2xl border border-white/[0.06] bg-white/[0.02] p-1 gap-1">
            <button
              type="button"
              onClick={() => setTab("pac")}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
                tab === "pac"
                  ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25"
                  : "text-white/40 hover:text-white/60"
              }`}
            >
              <RefreshCw className="h-4 w-4" />
              PAC
            </button>
            {canPayOneTime && (
              <>
                <button
                  type="button"
                  onClick={() => setTab("flow")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
                    tab === "flow"
                      ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  Pago único
                </button>
                <button
                  type="button"
                  onClick={() => setTab("transfer")}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-all ${
                    tab === "transfer"
                      ? "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  Transferencia
                </button>
              </>
            )}
          </div>

          {/* ── PAC tab ── */}
          {tab === "pac" && (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold mb-1">Pago Automatico con Cargo (PAC)</h2>
                <p className="text-xs text-white/50">
                  Registra tu tarjeta y activa el cobro automatico mensual.
                  Se cargara automaticamente cada mes sin que tengas que hacer nada.
                </p>
              </div>

              <div className="rounded-2xl border border-fuchsia-500/10 bg-fuchsia-500/[0.04] p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-fuchsia-300">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  Renovación automática mensual
                </div>
                <div className="flex items-center gap-2 text-xs text-fuchsia-300">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                  Cancela cuando quieras, sin penalización
                </div>
                <div className="flex items-center gap-2 text-xs text-fuchsia-300">
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  Pago seguro via Flow.cl
                </div>
              </div>

              {pacError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {pacError}
                </div>
              )}

              <button
                onClick={handleStartPAC}
                disabled={pacBusy}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_24px_rgba(168,85,247,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {pacBusy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Redirigiendo a Flow...</>
                ) : (
                  <><CreditCard className="h-4 w-4" /> Registrar tarjeta y activar PAC — ${price.toLocaleString("es-CL")}/mes</>
                )}
              </button>
            </div>
          )}

          {/* ── Flow one-time tab ── */}
          {tab === "flow" && (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold mb-1">Pago único con Flow.cl</h2>
                <p className="text-xs text-white/50">
                  Paga un mes con tarjeta de crédito, débito o transferencia bancaria. Deberás renovar manualmente cada mes.
                </p>
              </div>

              {/* Trust badges */}
              <div className="flex items-center gap-3 flex-wrap">
                {["Tarjeta débito/crédito", "Transferencia online", "Pago seguro SSL"].map((badge) => (
                  <span key={badge} className="inline-flex items-center gap-1 text-[10px] text-white/35 border border-white/[0.06] rounded-full px-2 py-0.5">
                    <Shield className="h-2.5 w-2.5" />
                    {badge}
                  </span>
                ))}
              </div>

              {user?.email && (
                <p className="text-xs text-white/40">
                  Se enviará el comprobante a: <span className="text-white/70">{user.email}</span>
                </p>
              )}

              {flowError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-300">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {flowError}
                </div>
              )}

              <button
                onClick={handleFlowPay}
                disabled={flowBusy}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_24px_rgba(168,85,247,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {flowBusy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Redirigiendo a Flow...</>
                ) : (
                  <><CreditCard className="h-4 w-4" /> Pagar ${price.toLocaleString("es-CL")} con Flow</>
                )}
              </button>
            </div>
          )}

          {/* ── Transfer tab ── */}
          {tab === "transfer" && !transferDone && (
            <div className="rounded-3xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold mb-1">Transferencia bancaria</h2>
                <p className="text-xs text-white/50">
                  Transfiere ${price.toLocaleString("es-CL")} CLP a la cuenta indicada y envíanos el comprobante.
                </p>
              </div>

              {/* Bank account info */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.05]">
                {[
                  { label: "Banco", value: BANK_INFO.bank, key: "bank" },
                  { label: "Tipo de cuenta", value: BANK_INFO.accountType, key: "type" },
                  { label: "Número de cuenta", value: BANK_INFO.accountNumber, key: "account" },
                  { label: "RUT", value: BANK_INFO.rut, key: "rut" },
                  { label: "Nombre", value: BANK_INFO.name, key: "name" },
                  { label: "Email", value: BANK_INFO.email, key: "email" },
                ].map(({ label, value, key }) => (
                  <div key={key} className="flex items-center justify-between px-3.5 py-2.5">
                    <div>
                      <p className="text-[10px] text-white/35 font-medium uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-white/80 font-medium">{value}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(value, key)}
                      className="ml-2 shrink-0 rounded-lg p-1.5 text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition"
                      title="Copiar"
                    >
                      {copied === key ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>

              {/* Approval info */}
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 px-3 py-2.5 text-xs text-amber-300/80">
                <Calendar className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>Una vez enviado tu comprobante, el equipo lo revisará en <strong>24 horas hábiles</strong> y activará tu cuenta.</span>
              </div>

              {/* Form */}
              <form onSubmit={handleTransferSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    Número de folio / comprobante <span className="text-fuchsia-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={folio}
                    onChange={(e) => setFolio(e.target.value)}
                    placeholder="Ej: 123456789"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-fuchsia-500/30 focus:outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    Banco desde el que transferiste
                  </label>
                  <input
                    type="text"
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="Ej: Banco Santander"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-fuchsia-500/30 focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-white/50 mb-1.5">
                    Comentarios adicionales (opcional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Cualquier detalle adicional..."
                    rows={2}
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-white/20 focus:border-fuchsia-500/30 focus:outline-none transition resize-none"
                  />
                </div>

                {transferError && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 px-3 py-2.5 text-xs text-red-300">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {transferError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={transferBusy || !folio.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_24px_rgba(168,85,247,0.35)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {transferBusy ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Banknote className="h-4 w-4" /> Enviar comprobante</>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Transfer success */}
          {tab === "transfer" && transferDone && (
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/[0.06] p-6 text-center space-y-3">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
                  <CheckCircle className="h-7 w-7 text-emerald-400" />
                </div>
              </div>
              <div>
                <h2 className="text-base font-semibold text-emerald-300">¡Comprobante enviado!</h2>
                <p className="mt-1 text-sm text-white/50">
                  Nuestro equipo revisará tu transferencia y activará tu cuenta en <strong className="text-white/70">24 horas hábiles</strong>.
                </p>
              </div>
              <Link href="/cuenta" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/[0.08] transition">
                Volver a mi cuenta
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
